# Developed by Mostofa Shakib (www.mostofashakib.com)
from __future__ import annotations
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable

ToolExecutor = Callable[[str, dict], Awaitable[str]]


class BaseLLMProvider(ABC):
    """Common interface all LLM providers must implement."""

    @abstractmethod
    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> str: ...

    async def complete_with_tools(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        tool_executor: ToolExecutor,
        max_tokens: int = 1024,
        max_rounds: int = 4,
    ) -> str:
        """Providers without native tool-use fall back to plain completion."""
        return await self.complete(system, messages, max_tokens)
