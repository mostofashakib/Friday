from __future__ import annotations
import os
from llm.base import BaseLLMProvider, ToolExecutor


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, model: str) -> None:
        self.model = model

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> str:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        response = await client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return response.content[0].text.strip()

    async def complete_with_tools(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        tool_executor: ToolExecutor,
        max_tokens: int = 1024,
        max_rounds: int = 4,
    ) -> str:
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
                text_blocks = [b for b in response.content if b.type == "text"]
                return text_blocks[0].text.strip() if text_blocks else ""

            tool_results = []
            for block in tool_blocks:
                result = await tool_executor(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(result),
                })

            current_messages.append({"role": "assistant", "content": response.content})
            current_messages.append({"role": "user", "content": tool_results})

        # Exhausted rounds — ask for a final plain-text response
        response = await client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=current_messages,
        )
        text_blocks = [b for b in response.content if b.type == "text"]
        return text_blocks[0].text.strip() if text_blocks else ""
