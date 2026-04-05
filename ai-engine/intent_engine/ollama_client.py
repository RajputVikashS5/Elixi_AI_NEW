"""Async Ollama HTTP client for ELIXI AI Engine."""

import httpx
import json
import logging
import os
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_TIMEOUT = 120.0


class OllamaClient:
    def __init__(self, base_url: Optional[str] = None):
        # Allow explicit override, then environment, then sane local default.
        resolved_base_url = (base_url or os.getenv("OLLAMA_BASE_URL") or DEFAULT_OLLAMA_BASE_URL).strip()
        self.base_url = resolved_base_url.rstrip("/")

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.error("Failed to list Ollama models: %s", e)
            return []

    async def generate(
        self,
        prompt: str,
        model: str = "llama3",
        system: Optional[str] = None,
        stream: bool = True,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from Ollama generate API."""
        payload: dict = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
            "options": {"temperature": 0.7, "num_predict": 1024},
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("response", "")
                        if token:
                            yield token
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue

    async def chat(
        self,
        messages: list[dict],
        model: str = "llama3",
        stream: bool = True,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from Ollama chat API."""
        payload: dict = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "options": {"temperature": 0.7, "num_predict": 1024},
        }

        def _messages_to_prompt(items: list[dict]) -> str:
            lines: list[str] = []
            for item in items:
                role = str(item.get("role", "user")).upper()
                content = str(item.get("content", "")).strip()
                if content:
                    lines.append(f"{role}: {content}")
            lines.append("ASSISTANT:")
            return "\n\n".join(lines)

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
            ) as response:
                if response.status_code == 404:
                    logger.warning("Ollama /api/chat unavailable, falling back to /api/generate")
                    async for token in self.generate(
                        prompt=_messages_to_prompt(messages),
                        model=model,
                        stream=stream,
                    ):
                        yield token
                    return

                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            yield token
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
