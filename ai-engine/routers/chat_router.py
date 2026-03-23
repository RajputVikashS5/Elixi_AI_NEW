"""Chat router with intent classification and optional SSE streaming."""

import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import ChatRequest, ChatResponse, IntentRequest, IntentResponse
from intent_engine.intent_classifier import IntentClassifier
from intent_engine.entity_extractor import EntityExtractor
from intent_engine.prompt_builder import PromptBuilder
from intent_engine.ollama_client import OllamaClient
from intent_engine.response_parser import ResponseParser
from memory_engine.memory_router import MemoryRouter

router = APIRouter()

intent_classifier = IntentClassifier()
entity_extractor = EntityExtractor()
prompt_builder = PromptBuilder()
ollama_client = OllamaClient()
response_parser = ResponseParser()
memory_router = MemoryRouter()


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
    intent = intent_classifier.classify(body.message)
    intent_confidence = intent_classifier.confidence_for(body.message, intent)
    entities = entity_extractor.extract_all(body.message)
    model = body.ollamaModel.value if body.ollamaModel else "llama3"

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

    if body.stream:
        async def stream_generator():
            full_text = ""
            try:
                async for token in ollama_client.chat(messages=messages, model=model, stream=True):
                    full_text += token
                    yield _to_sse({"token": token, "done": False})

                parsed = response_parser.parse(
                    full_text,
                    fallback_intent=intent.value,
                    fallback_entities=entities,
                )
                actions = _merge_actions(parsed.get("actions"), context.get("proactive_habits", []))
                memory_router.record_message(body.sessionId, "assistant", parsed["content"])
                yield _to_sse(
                    {
                        "content": parsed["content"],
                        "response": parsed.get("response", parsed["content"]),
                        "intent": parsed.get("intent", intent.value),
                        "action": parsed.get("action", "respond"),
                        "entities": parsed.get("entities", entities),
                        "confidence": float(parsed.get("confidence", intent_confidence)),
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
        async for token in ollama_client.chat(messages=messages, model=model, stream=True):
            full_text += token

        parsed = response_parser.parse(
            full_text,
            fallback_intent=intent.value,
            fallback_entities=entities,
        )
        actions = _merge_actions(parsed.get("actions"), context.get("proactive_habits", []))
        memory_router.record_message(body.sessionId, "assistant", parsed["content"])
        return ChatResponse(
            content=parsed["content"],
            response=parsed.get("response", parsed["content"]),
            intent=parsed.get("intent", intent.value),
            action=parsed.get("action", "respond"),
            entities=parsed.get("entities", entities),
            confidence=float(parsed.get("confidence", intent_confidence)),
            actions=actions,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")
