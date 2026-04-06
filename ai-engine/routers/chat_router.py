"""Chat router with intent classification and optional SSE streaming."""

import json
import logging
import os
import platform
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from models.schemas import ChatRequest, ChatResponse, IntentRequest, IntentResponse
from models.enums import IntentCategory
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
from core.security import AuthUser, require_auth
from memory_engine.memory_router import MemoryRouter
from services.response_validation import validate_ai_response

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
BACKEND_URL = os.getenv("BACKEND_URL", os.getenv("ELIXI_BACKEND_URL", "http://127.0.0.1:3001")).rstrip("/")


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


def _format_gb(value: int | float) -> str:
    return f"{value / (1024 ** 3):.1f} GB"


def _format_uptime(seconds: int | float | None) -> str:
    if seconds is None:
        return "unknown"

    total_seconds = int(seconds)
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)

    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes or not parts:
        parts.append(f"{minutes}m")

    return " ".join(parts)


async def _fetch_system_info() -> dict:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(f"{BACKEND_URL}/api/system/info")
        response.raise_for_status()
        return response.json()


async def _fetch_learning_verbosity() -> tuple[str | None, int | None]:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(f"{BACKEND_URL}/api/learning/insights?limit=5&min_occurrences=2")
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return (None, None)

    verbosity = payload.get("verbosityAdaptation") if isinstance(payload, dict) else None
    if not isinstance(verbosity, dict):
        return (None, None)

    level = verbosity.get("level")
    target_words = verbosity.get("targetResponseWords")

    parsed_level = str(level) if isinstance(level, str) and level.strip() else None
    parsed_target = int(target_words) if isinstance(target_words, (int, float)) else None
    return (parsed_level, parsed_target)


def _build_system_info_response(system_info: dict) -> dict:
    cpu_load = float(system_info.get("cpu") or 0.0)
    ram = system_info.get("ram") or {}
    cpu_info = system_info.get("cpuInfo") or {}
    os_info = system_info.get("osInfo") or {}

    cpu_parts = [part for part in [cpu_info.get("brand"), cpu_info.get("manufacturer")] if part]
    cpu_label = " ".join(cpu_parts).strip() or "CPU"
    os_parts = [
        os_info.get("distro") or os_info.get("platform") or system_info.get("platform") or platform.system(),
        os_info.get("release"),
    ]
    os_label = " ".join(part for part in os_parts if part).strip()

    response_text = "\n".join(
        [
            "Here's your system information:",
            f"CPU {cpu_label} ({cpu_load:.1f}%)",
            f"RAM {_format_gb(ram.get('used', 0))} / {_format_gb(ram.get('total', 0))}",
            f"OS {os_label}",
            f"Uptime {_format_uptime(system_info.get('uptime'))}",
        ]
    )

    return {
        "intent": "automation.system_info",
        "emotion_detected": "neutral",
        "response_text": response_text,
        "message": response_text,
        "voice_tone": "neutral",
        "action": "respond",
        "confidence": 1.0,
        "content": response_text,
        "response": response_text,
        "entities": {
            "cpu": cpu_load,
            "ram_used": ram.get("used"),
            "ram_total": ram.get("total"),
            "os": os_label,
        },
        "actions": [],
    }


@router.post("/intent", response_model=IntentResponse)
async def classify_intent(body: IntentRequest) -> IntentResponse:
    intent = intent_classifier.classify(body.message)
    entities = entity_extractor.extract_all(body.message)
    confidence = intent_classifier.confidence_for(body.message, intent)
    return IntentResponse(intent=intent.value, confidence=confidence, entities=entities)


@router.post("/chat")
async def chat(body: ChatRequest, user: AuthUser = Depends(require_auth)):
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
                        "message": greeting_response["response_text"],
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
            message=greeting_response["response_text"],
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

    if intent == IntentCategory.AUTOMATION_SYSTEM_INFO:
        try:
            system_info = await _fetch_system_info()
            response_payload = _build_system_info_response(system_info)
            if body.stream:
                async def system_info_stream():
                    yield _to_sse({**response_payload, "done": True})

                return StreamingResponse(system_info_stream(), media_type="text/event-stream")

            return ChatResponse(**response_payload)
        except Exception as exc:
            logger.warning("System info lookup failed", exc_info=exc)
            fallback_text = "I could not retrieve live system information right now."
            if body.stream:
                async def fallback_stream():
                    yield _to_sse({
                        "error": fallback_text,
                        "done": True,
                    })

                return StreamingResponse(fallback_stream(), media_type="text/event-stream")

            return ChatResponse(
                intent=IntentCategory.AUTOMATION_SYSTEM_INFO.value,
                emotion_detected="neutral",
                response_text=fallback_text,
                message=fallback_text,
                voice_tone="neutral",
                action="respond",
                confidence=0.5,
                content=fallback_text,
                response=fallback_text,
                entities={},
                actions=[],
            )

    provider = body.llmProvider.value if body.llmProvider else "ollama"
    ollama_model = body.ollamaModel.value if body.ollamaModel else "llama3"
    configured_online_model = (body.onlineModel or "").strip()
    openrouter_model = configured_online_model or DEFAULT_OPENROUTER_MODEL
    gemini_model = configured_online_model or DEFAULT_GEMINI_MODEL

    context = await memory_router.get_context(
        body.sessionId,
        body.message,
        owner_id=user.sub,
        intent=intent.value,
        entities=entities,
    )

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
    verbosity_level, target_response_words = await _fetch_learning_verbosity()

    system_prompt = prompt_builder.build_system_prompt(
        personality_mode=(body.personalityMode.value if body.personalityMode else "friendly"),
        emotion_context=body.emotionContext,
        injected_memories=memory_lines,
        proactive_habits=proactive_lines,
        verbosity_level=verbosity_level,
        target_response_words=target_response_words,
    )

    history = context.get("short_history", [])
    messages = prompt_builder.build_messages(body.message, history, system_prompt)

    # Emotion detection from context
    emotion_detected = None
    if body.emotionContext and body.emotionContext.state:
        emotion_detected = body.emotionContext.state

    async def model_streamer():
        async def stream_online_fallback(fallback_reason: str):
            fallback_candidates = [
                ("openrouter", openrouter_model),
                ("gemini", gemini_model),
            ]

            for fallback_provider, fallback_model in fallback_candidates:
                if not online_client.is_configured(fallback_provider):
                    continue
                try:
                    logger.warning(
                        "Ollama unavailable (%s); falling back to %s",
                        fallback_reason,
                        fallback_provider,
                    )
                    async for token in online_client.chat(
                        messages=messages,
                        model=fallback_model,
                        stream=True,
                        provider=fallback_provider,
                    ):
                        yield token
                    return
                except Exception as fallback_exc:
                    logger.warning(
                        "Fallback provider %s failed after Ollama issue: %s",
                        fallback_provider,
                        fallback_exc,
                    )

            raise RuntimeError(
                "Ollama is unavailable and no configured online fallback providers succeeded."
            )

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

        if not await ollama_client.is_available():
            async for token in stream_online_fallback("connection check failed"):
                yield token
            return

        try:
            async for token in ollama_client.chat(messages=messages, model=ollama_model, stream=True):
                yield token
        except Exception as exc:
            async for token in stream_online_fallback(str(exc)):
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
                validated = validate_ai_response(parsed, fallback_intent=intent.value, fallback_emotion=emotion_detected)
                
                # Constrain response length
                response_text = ResponseLengthOptimizer.constrain_length(
                    validated.message,
                    validated.intent,
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
                        "emotion_detected": validated.emotion,
                        "response_text": response_text,
                        "message": response_text,
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
        validated = validate_ai_response(parsed, fallback_intent=intent.value, fallback_emotion=emotion_detected)
        
        # Constrain response length
        response_text = ResponseLengthOptimizer.constrain_length(
            validated.message,
            validated.intent,
        )
        
        # Determine voice tone if not provided by LLM
        voice_tone = parsed.get("voice_tone")
        if not voice_tone:
            voice_tone = VoiceToneMapper.emotion_to_tone(emotion_detected)
        
        actions = _merge_actions(parsed.get("actions"), context.get("proactive_habits", []))
        memory_router.record_message(body.sessionId, "assistant", response_text)
        
        return ChatResponse(
            intent=validated.intent,
            emotion_detected=validated.emotion,
            response_text=response_text,
            message=response_text,
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
