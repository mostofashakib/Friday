from __future__ import annotations
import os
from llm.base import BaseLLMProvider


class GoogleProvider(BaseLLMProvider):
    def __init__(self, model: str) -> None:
        self.model = model

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> str:
        import google.generativeai as genai
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        model = genai.GenerativeModel(
            model_name=self.model,
            system_instruction=system,
            generation_config={"max_output_tokens": max_tokens},
        )
        history = [
            {"role": "user" if m["role"] == "user" else "model", "parts": [m["content"]]}
            for m in messages[:-1]
        ]
        chat = model.start_chat(history=history)
        response = await chat.send_message_async(messages[-1]["content"])
        return response.text.strip()
