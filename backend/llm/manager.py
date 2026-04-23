from __future__ import annotations
import os
from collections.abc import Awaitable, Callable
from enum import Enum

import httpx


class LLMProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"
    OLLAMA = "ollama"


_DEFAULT_MODELS: dict[LLMProvider, str] = {
    LLMProvider.ANTHROPIC: "claude-haiku-4-5-20251001",
    LLMProvider.OPENAI: "gpt-4o-mini",
    LLMProvider.GOOGLE: "gemini-1.5-flash",
    LLMProvider.OLLAMA: "llama3.2",
}

ToolExecutor = Callable[[str, dict], Awaitable[str]]


class LLMManager:
    def __init__(self, provider: LLMProvider = LLMProvider.ANTHROPIC, model: str | None = None):
        self.provider = provider
        self.model = model or _DEFAULT_MODELS[provider]

    # ── Plain completion ───────────────────────────────────────────────────────

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> str:
        match self.provider:
            case LLMProvider.ANTHROPIC:
                return await self._anthropic(system, messages, max_tokens)
            case LLMProvider.OPENAI:
                return await self._openai(system, messages, max_tokens)
            case LLMProvider.GOOGLE:
                return await self._google(system, messages, max_tokens)
            case LLMProvider.OLLAMA:
                return await self._ollama(system, messages, max_tokens)

    # ── Agentic tool-use loop ─────────────────────────────────────────────────

    async def complete_with_tools(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        tool_executor: ToolExecutor,
        max_tokens: int = 1024,
        max_rounds: int = 4,
    ) -> str:
        """
        Run an agentic tool-use loop until the model produces a plain text response.

        The model can call tools multiple times per completion. Each tool call is
        executed via `tool_executor(name, input) -> str` and the result is fed back.

        Falls back to plain `complete()` for providers that don't support tool use.
        """
        if self.provider != LLMProvider.ANTHROPIC:
            # Other providers: best-effort plain completion (no tool use)
            return await self.complete(system, messages, max_tokens)

        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

        current_messages = list(messages)

        for _ in range(max_rounds):
            response = await client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=current_messages,
                tools=tools,
                tool_choice={"type": "auto"},
            )

            tool_blocks = [b for b in response.content if b.type == "tool_use"]

            if not tool_blocks:
                # No tool calls — extract text and return
                text_blocks = [b for b in response.content if b.type == "text"]
                return text_blocks[0].text.strip() if text_blocks else ""

            # Execute every tool the model requested
            tool_results = []
            for block in tool_blocks:
                result = await tool_executor(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(result),
                })

            # Append the assistant turn (with tool_use blocks) and the tool results
            current_messages.append({"role": "assistant", "content": response.content})
            current_messages.append({"role": "user", "content": tool_results})

        # Fell out of the loop — ask for a final plain-text response
        response = await client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=current_messages,
        )
        text_blocks = [b for b in response.content if b.type == "text"]
        return text_blocks[0].text.strip() if text_blocks else ""

    # ── Provider implementations ───────────────────────────────────────────────

    async def _anthropic(self, system: str, messages: list[dict], max_tokens: int) -> str:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        response = await client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return response.content[0].text.strip()

    async def _openai(self, system: str, messages: list[dict], max_tokens: int) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        msgs = [{"role": "system", "content": system}] + messages
        response = await client.chat.completions.create(
            model=self.model,
            messages=msgs,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

    async def _google(self, system: str, messages: list[dict], max_tokens: int) -> str:
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

    async def _ollama(self, system: str, messages: list[dict], max_tokens: int) -> str:
        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        msgs = [{"role": "system", "content": system}] + messages
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={"model": self.model, "messages": msgs, "stream": False, "options": {"num_predict": max_tokens}},
            )
            response.raise_for_status()
            return response.json()["message"]["content"].strip()


def get_llm(provider: str | None = None, model: str | None = None) -> LLMManager:
    """Return an LLM manager. Defaults to Anthropic unless LLM_PROVIDER env var is set."""
    p = LLMProvider(provider or os.environ.get("LLM_PROVIDER", "anthropic"))
    return LLMManager(provider=p, model=model)
