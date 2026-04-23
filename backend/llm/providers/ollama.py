from __future__ import annotations
import os
import httpx
from llm.base import BaseLLMProvider


class OllamaProvider(BaseLLMProvider):
    def __init__(self, model: str) -> None:
        self.model = model

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> str:
        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        msgs = [{"role": "system", "content": system}] + messages
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": msgs,
                    "stream": False,
                    "options": {"num_predict": max_tokens},
                },
            )
            response.raise_for_status()
            return response.json()["message"]["content"].strip()
