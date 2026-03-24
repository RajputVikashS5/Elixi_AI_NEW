"""Async online LLM client supporting OpenRouter and Gemini."""

import json
import logging
import os
from typing import Any, AsyncGenerator, cast

import httpx

logger = logging.getLogger(__name__)

DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3-8b-instruct"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
DEFAULT_TIMEOUT = 120.0


class OnlineLLMClient:
    def __init__(self):
        self.openrouter_base_url = os.getenv("OPENROUTER_BASE_URL", DEFAULT_OPENROUTER_BASE_URL).strip().rstrip("/")
        self.openrouter_api_key = (
            os.getenv("OPENROUTER_API_KEY", "").strip()
            or os.getenv("ELIXI_ONLINE_API_KEY", "").strip()
        )
        self.openrouter_default_model = (
            os.getenv("OPENROUTER_MODEL", "").strip()
            or os.getenv("ELIXI_ONLINE_MODEL", "").strip()
            or DEFAULT_OPENROUTER_MODEL
        )

        self.gemini_base_url = os.getenv("GEMINI_BASE_URL", DEFAULT_GEMINI_BASE_URL).strip().rstrip("/")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_default_model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL

    def is_configured(self, provider: str = "openrouter") -> bool:
        normalized = provider.strip().lower()
        if normalized in {"openrouter", "online"}:
            return bool(self.openrouter_api_key)
        if normalized == "gemini":
            return bool(self.gemini_api_key)
        return False

    def _build_user_prompt_from_messages(self, messages: list[dict[str, Any]]) -> str:
        system_parts: list[str] = []
        user_parts: list[str] = []

        for message in messages:
            role = str(message.get("role") or "").lower()
            content = str(message.get("content") or "").strip()
            if not content:
                continue
            if role == "system":
                system_parts.append(content)
            elif role == "user":
                user_parts.append(content)

        system_text = "\n\n".join(system_parts).strip()
        user_text = user_parts[-1].strip() if user_parts else ""

        if system_text and user_text:
            return f"{system_text}\n\nUser: {user_text}"
        if system_text:
            return system_text
        return user_text

    async def _chat_openrouter(
        self,
        messages: list[dict[str, Any]],
        model: str | None,
        stream: bool,
    ) -> AsyncGenerator[str, None]:
        if not self.is_configured("openrouter"):
            raise RuntimeError("OPENROUTER_API_KEY is not set")

        target_model = (model or self.openrouter_default_model).strip() or DEFAULT_OPENROUTER_MODEL
        payload: dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.7,
            "stream": stream,
        }
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "Elixi AI Engine"),
        }
        endpoint = f"{self.openrouter_base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            if not stream:
                response = await client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                content = (
                    response.json()
                    .get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                if isinstance(content, str) and content.strip():
                    yield content
                return

            async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                response.raise_for_status()
                async for raw_line in response.aiter_lines():
                    line = raw_line.strip()
                    if not line:
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if line == "[DONE]":
                        break

                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    raw_choices = chunk.get("choices")
                    if not isinstance(raw_choices, list) or not raw_choices:
                        continue
                    choices = cast(list[Any], raw_choices)

                    first_choice: Any = choices[0]
                    if not isinstance(first_choice, dict):
                        continue
                    choice_obj = cast(dict[str, Any], first_choice)

                    delta = choice_obj.get("delta")
                    if not isinstance(delta, dict):
                        continue
                    delta_obj = cast(dict[str, Any], delta)

                    token = delta_obj.get("content")
                    if isinstance(token, str) and token:
                        yield token

    async def _chat_gemini(
        self,
        messages: list[dict[str, Any]],
        model: str | None,
        stream: bool,
    ) -> AsyncGenerator[str, None]:
        if not self.is_configured("gemini"):
            raise RuntimeError("GEMINI_API_KEY is not set")

        target_model = (model or self.gemini_default_model).strip() or DEFAULT_GEMINI_MODEL
        prompt = self._build_user_prompt_from_messages(messages)
        if not prompt:
            raise RuntimeError("Gemini prompt is empty")

        endpoint = f"{self.gemini_base_url}/models/{target_model}:generateContent"
        params = {"key": self.gemini_api_key}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024},
        }

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(endpoint, params=params, json=payload)
            response.raise_for_status()
            data = response.json()

        parts = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [])
        )
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
        if not text:
            raise RuntimeError("Gemini returned empty response")

        if not stream:
            yield text
            return

        chunk_size = 100
        for start in range(0, len(text), chunk_size):
            yield text[start:start + chunk_size]

    async def chat(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        stream: bool = True,
        provider: str = "openrouter",
    ) -> AsyncGenerator[str, None]:
        normalized = provider.strip().lower()
        if normalized in {"openrouter", "online"}:
            async for token in self._chat_openrouter(messages=messages, model=model, stream=stream):
                yield token
            return

        if normalized == "gemini":
            async for token in self._chat_gemini(messages=messages, model=model, stream=stream):
                yield token
            return

        raise RuntimeError(f"Unsupported online provider: {provider}")
