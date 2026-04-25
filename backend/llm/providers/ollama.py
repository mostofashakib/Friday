from __future__ import annotations
import os
import re
import httpx
from llm.base import BaseLLMProvider, ToolExecutor


_TOOL_CALL_PATTERNS = [
    re.compile(r'<tool_call>.*?</tool_call>', re.DOTALL | re.IGNORECASE),
    re.compile(r'\[TOOL_CALL\].*?\[/TOOL_CALL\]', re.DOTALL | re.IGNORECASE),
    re.compile(r'```tool\b.*?```', re.DOTALL),
    # JSON-style function call blobs: {"name": "...", "arguments": {...}}
    re.compile(r'\{["\']name["\']\s*:\s*["\'][^"\']+["\'][^}]*\}', re.DOTALL),
]


def _strip_tool_calls(text: str) -> str:
    for pattern in _TOOL_CALL_PATTERNS:
        text = pattern.sub('', text)
    return text.strip()


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
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": msgs,
                    "stream": False,
                    "think": False,
                    "options": {"num_predict": max_tokens},
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["message"].get("content", "").strip()
            # Fallback: some models put the answer in "thinking" when content is empty
            if not content:
                content = data["message"].get("thinking", "").strip()
            return content

    async def complete_with_tools(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        tool_executor: ToolExecutor,
        max_tokens: int = 1024,
        max_rounds: int = 4,
    ) -> str:
        no_tool_system = (
            system
            + "\n\nCRITICAL: You cannot call any tools or functions. "
            "Do NOT output tool calls, function calls, or JSON blobs. "
            "Generate your final plain-text response directly."
        )
        raw = await self.complete(no_tool_system, messages, max_tokens)
        cleaned = _strip_tool_calls(raw)
        return cleaned if cleaned else raw
