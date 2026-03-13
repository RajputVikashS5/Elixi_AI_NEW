"""Chat router with intent classification and optional SSE streaming."""

import json
import uuid
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
    return f"data: {json.dumps(payload)}\\n\\n"


@router.post("/intent", response_model=IntentResponse)
async def classify_intent(body: IntentRequest) -> IntentResponse:
    intent = intent_classifier.classify(body.message)
    entities = entity_extractor.extract_all(body.message)
    return IntentResponse(intent=intent.value, confidence=0.75, entities=entities)


@router.post("/chat")
async def chat(body: ChatRequest):
    intent = intent_classifier.classify(body.message)
    model = body.ollamaModel.value if body.ollamaModel else "llama3"

    context = await memory_router.get_context(body.sessionId, body.message)
    memory_lines = [f"{x.get('key')}: {x.get('value')}" for x in context.get("long_facts", [])[:5]]

    system_prompt = prompt_builder.build_system_prompt(
        personality_mode=(body.personalityMode.value if body.personalityMode else "friendly"),
        emotion_context=body.emotionContext,
        injected_memories=memory_lines,
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

                parsed = response_parser.parse(full_text)
                yield _to_sse(
                    {
                        "content": parsed["content"],
                        "intent": intent.value,
                        "actions": parsed["actions"],
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

        parsed = response_parser.parse(full_text)
        return ChatResponse(content=parsed["content"], intent=intent.value, actions=parsed["actions"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")
