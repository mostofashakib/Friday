from __future__ import annotations
import os
from llm.base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, model: str) -> None:
        self.model = model

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        msgs = [{"role": "system", "content": system}] + messages
        response = await client.chat.completions.create(
            model=self.model,
            messages=msgs,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()
