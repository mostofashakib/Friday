# Developed by Mostofa Shakib (www.mostofashakib.com)
from __future__ import annotations
import os
from enum import Enum
from llm.base import BaseLLMProvider, ToolExecutor

# Re-export ToolExecutor so existing callers don't need to change their imports.
__all__ = ["LLMManager", "LLMProvider", "get_llm", "ToolExecutor"]


class LLMProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"
    OLLAMA = "ollama"


_DEFAULT_MODELS: dict[LLMProvider, str] = {
    LLMProvider.ANTHROPIC: "claude-haiku-4-5-20251001",
    LLMProvider.OPENAI: "gpt-4o-mini",
    LLMProvider.GOOGLE: "gemini-1.5-flash",
    LLMProvider.OLLAMA: "gemma4:26b",
}


def _build_provider(provider: LLMProvider, model: str) -> BaseLLMProvider:
    match provider:
        case LLMProvider.ANTHROPIC:
            from llm.providers.anthropic import AnthropicProvider
            return AnthropicProvider(model)
        case LLMProvider.OPENAI:
            from llm.providers.openai import OpenAIProvider
            return OpenAIProvider(model)
        case LLMProvider.GOOGLE:
            from llm.providers.google import GoogleProvider
            return GoogleProvider(model)
        case LLMProvider.OLLAMA:
            from llm.providers.ollama import OllamaProvider
            return OllamaProvider(model)


class LLMManager:
    """Thin wrapper that delegates to the selected provider. Public API is unchanged."""

    def __init__(self, provider: LLMProvider = LLMProvider.ANTHROPIC, model: str | None = None):
        self.provider = provider
        resolved_model = model or _DEFAULT_MODELS[provider]
        self._provider: BaseLLMProvider = _build_provider(provider, resolved_model)

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> str:
        return await self._provider.complete(system, messages, max_tokens)

    async def complete_with_tools(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        tool_executor: ToolExecutor,
        max_tokens: int = 1024,
        max_rounds: int = 4,
    ) -> str:
        return await self._provider.complete_with_tools(
            system, messages, tools, tool_executor, max_tokens, max_rounds
        )


def get_llm(provider: str | None = None, model: str | None = None) -> LLMManager:
    """Return an LLM manager. Reads LLM_PROVIDER env var; defaults to Anthropic."""
    p = LLMProvider(provider or os.environ.get("LLM_PROVIDER", "ollama"))
    return LLMManager(provider=p, model=model)
