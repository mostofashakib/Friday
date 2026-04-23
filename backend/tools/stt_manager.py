from __future__ import annotations
import os
from enum import Enum

from openai import AsyncOpenAI


class STTProvider(str, Enum):
    OPENAI = "openai"


class STTManager:
    def __init__(self, provider: STTProvider = STTProvider.OPENAI):
        self.provider = provider

    async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        """Transcribe audio bytes. Returns transcript string."""
        match self.provider:
            case STTProvider.OPENAI:
                return await self._openai(audio_bytes, filename, content_type)

    async def _openai(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        result = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, content_type),
        )
        return result.text


def get_stt(provider: str | None = None) -> STTManager:
    """Return an STTManager. Reads STT_PROVIDER env var; defaults to openai."""
    p = STTProvider(provider or os.environ.get("STT_PROVIDER", "openai"))
    return STTManager(provider=p)
