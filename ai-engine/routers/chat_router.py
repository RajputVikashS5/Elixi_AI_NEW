"""Chat router with intent classification and optional SSE streaming."""

import json
import logging
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import ChatRequest, ChatResponse, IntentRequest, IntentResponse
from intent_engine.intent_classifier import IntentClassifier
from intent_engine.entity_extractor import EntityExtractor
from intent_engine.prompt_builder import PromptBuilder
from intent_engine.ollama_client import OllamaClient
from intent_engine.online_client import OnlineLLMClient
from intent_engine.response_parser import ResponseParser
from emotion_engine.elixi_personality import (
    ResponseFormatter,
    SessionManager,
    VoiceToneMapper,
    ResponseLengthOptimizer,
)
from memory_engine.memory_router import MemoryRouter

router = APIRouter()
logger = logging.getLogger(__name__)

intent_classifier = IntentClassifier()
entity_extractor = EntityExtractor()
prompt_builder = PromptBuilder()
ollama_client = OllamaClient()
online_client = OnlineLLMClient()
response_parser = ResponseParser()
memory_router = MemoryRouter()

DEFAULT_OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", os.getenv("ELIXI_ONLINE_MODEL", "meta-llama/llama-3-8b-instruct"))
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def _to_sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _merge_actions(base_actions: list[dict] | None, proactive_habits: list[dict]) -> list[dict]:
    merged: list[dict] = list(base_actions or [])
    seen = {(item.get("type"), item.get("target")) for item in merged if isinstance(item, dict)}

    for suggestion in proactive_habits:
        action = suggestion.get("action") if isinstance(suggestion, dict) else None
        if not isinstance(action, dict):
            continue
        key = (action.get("type"), action.get("target"))
        if key in seen:
            continue
        merged.append(action)
        seen.add(key)

    return merged


@router.post("/intent", response_model=IntentResponse)
async def classify_intent(body: IntentRequest) -> IntentResponse:
    intent = intent_classifier.classify(body.message)
    entities = entity_extractor.extract_all(body.message)
    confidence = intent_classifier.confidence_for(body.message, intent)
    return IntentResponse(intent=intent.value, confidence=confidence, entities=entities)


@router.post("/chat")
async def chat(body: ChatRequest):
    # Check if this is a session start - if so, send greeting first
    intent = intent_classifier.classify(body.message)
    is_session_start = SessionManager.is_session_start(body.sessionId, intent.value, body.message)
    
    if is_session_start:
        SessionManager.mark_session_started(body.sessionId)
        greeting_response = ResponseFormatter.create_greeting(body.sessionId)
        if body.stream:
            async def greeting_stream():
                yield _to_sse(
                    {
                        "intent": greeting_response["intent"],
                        "emotion_detected": greeting_response["emotion_detected"],
                        "response_text": greeting_response["response_text"],
                        "voice_tone": greeting_response["voice_tone"],
                        "action": greeting_response["action"],
                        "confidence": greeting_response["confidence"],
                        "content": greeting_response["response_text"],
                        "response": greeting_response["response_text"],
                        "entities": greeting_response.get("entities", {}),
                        "actions": greeting_response.get("actions", []),
                        "done": True,
                    }
                )

            return StreamingResponse(greeting_stream(), media_type="text/event-stream")

        return ChatResponse(
            intent=greeting_response["intent"],
            emotion_detected=greeting_response["emotion_detected"],
            response_text=greeting_response["response_text"],
            voice_tone=greeting_response["voice_tone"],
            action=greeting_response["action"],
            confidence=greeting_response["confidence"],
            content=greeting_response["response_text"],
            response=greeting_response["response_text"],
            entities=greeting_response.get("entities", {}),
            actions=greeting_response.get("actions", []),
        )
    
    intent_confidence = intent_classifier.confidence_for(body.message, intent)
    entities = entity_extractor.extract_all(body.message)
    provider = body.llmProvider.value if body.llmProvider else "ollama"
    ollama_model = body.ollamaModel.value if body.ollamaModel else "llama3"
    configured_online_model = (body.onlineModel or "").strip()
    openrouter_model = configured_online_model or DEFAULT_OPENROUTER_MODEL
    gemini_model = configured_online_model or DEFAULT_GEMINI_MODEL

    context = await memory_router.get_context(body.sessionId, body.message, intent.value, entities)

    if intent.value in {"action_cancel", "action_repeat"}:
        last_user_command = next(
            (m.get("content") for m in reversed(context.get("short_history", [])) if m.get("role") == "user"),
            None,
        )
        if last_user_command:
            entities["refers_to"] = last_user_command

    memory_router.record_message(body.sessionId, "user", body.message)
    await memory_router.record_interaction(body.message, intent.value, entities)

    memory_lines = [f"{x.get('key')}: {x.get('value')}" for x in context.get("long_facts", [])[:5]]
    memory_lines.extend(x.get("content", "") for x in context.get("vector_matches", [])[:3])
    proactive_lines = [item.get("description", "") for item in context.get("proactive_habits", [])[:3]]

    system_prompt = prompt_builder.build_system_prompt(
        personality_mode=(body.personalityMode.value if body.personalityMode else "friendly"),
        emotion_context=body.emotionContext,
        injected_memories=memory_lines,
        proactive_habits=proactive_lines,
    )

    history = context.get("short_history", [])
    messages = prompt_builder.build_messages(body.message, history, system_prompt)

    # Emotion detection from context
    emotion_detected = None
    if body.emotionContext and body.emotionContext.state:
        emotion_detected = body.emotionContext.state

    async def model_streamer():
        if provider in {"online", "openrouter", "gemini"}:
            provider_key = "openrouter" if provider == "online" else provider
            provider_model = openrouter_model if provider_key == "openrouter" else gemini_model

            if not online_client.is_configured(provider_key):
                if await ollama_client.is_available():
                    logger.warning("%s provider not configured; falling back to Ollama", provider_key)
                    async for token in ollama_client.chat(messages=messages, model=ollama_model, stream=True):
                        yield token
                    return
                raise RuntimeError(
                    f"{provider_key} provider is not configured. Set required API key in ai-engine environment."
                )

            try:
                async for token in online_client.chat(
                    messages=messages,
                    model=provider_model,
                    stream=True,
                    provider=provider_key,
                ):
                    yield token
                return
            except Exception as exc:
                if await ollama_client.is_available():
                    logger.warning("%s provider failed (%s); falling back to Ollama", provider_key, exc)
                    async for token in ollama_client.chat(messages=messages, model=ollama_model, stream=True):
                        yield token
                    return
                raise RuntimeError(f"{provider_key} AI request failed: {str(exc)}") from exc

        async for token in ollama_client.chat(messages=messages, model=ollama_model, stream=True):
            yield token

    if body.stream:
        async def stream_generator():
            full_text = ""
            try:
                async for token in model_streamer():
                    full_text += token
                    yield _to_sse({"token": token, "done": False})

                parsed = response_parser.parse(
                    full_text,
                    fallback_intent=intent.value,
                    fallback_entities=entities,
                    emotion_detected=emotion_detected,
                )
                
                # Constrain response length
                response_text = ResponseLengthOptimizer.constrain_length(
                    parsed.get("response_text", parsed["content"]),
                    intent.value
                )
                
                # Determine voice tone if not provided by LLM
                voice_tone = parsed.get("voice_tone")
                if not voice_tone:
                    voice_tone = VoiceToneMapper.emotion_to_tone(emotion_detected)
                
                actions = _merge_actions(parsed.get("actions"), context.get("proactive_habits", []))
                memory_router.record_message(body.sessionId, "assistant", response_text)
                
                yield _to_sse(
                    {
                        "intent": parsed.get("intent", intent.value),
                        "emotion_detected": emotion_detected,
                        "response_text": response_text,
                        "voice_tone": voice_tone,
                        "action": parsed.get("action", "respond"),
                        "confidence": float(parsed.get("confidence", intent_confidence)),
                        "content": response_text,
                        "response": response_text,
                        "entities": parsed.get("entities", entities),
                        "actions": actions,
                        "done": True,
                    }
                )
            except Exception as e:
                yield _to_sse(
                    {
                        "error": f"AI engine streaming failed: {str(e)}",
                        "done": True,
                    }
                )

        return StreamingResponse(stream_generator(), media_type="text/event-stream")

    try:
        full_text = ""
        async for token in model_streamer():
            full_text += token

        parsed = response_parser.parse(
            full_text,
            fallback_intent=intent.value,
            fallback_entities=entities,
            emotion_detected=emotion_detected,
        )
        
        # Constrain response length
        response_text = ResponseLengthOptimizer.constrain_length(
            parsed.get("response_text", parsed["content"]),
            intent.value
        )
        
        # Determine voice tone if not provided by LLM
        voice_tone = parsed.get("voice_tone")
        if not voice_tone:
            voice_tone = VoiceToneMapper.emotion_to_tone(emotion_detected)
        
        actions = _merge_actions(parsed.get("actions"), context.get("proactive_habits", []))
        memory_router.record_message(body.sessionId, "assistant", response_text)
        
        return ChatResponse(
            intent=parsed.get("intent", intent.value),
            emotion_detected=emotion_detected,
            response_text=response_text,
            voice_tone=voice_tone,
            action=parsed.get("action", "respond"),
            confidence=float(parsed.get("confidence", intent_confidence)),
            content=response_text,
            response=response_text,
            entities=parsed.get("entities", entities),
            actions=actions,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")
