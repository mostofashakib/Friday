from __future__ import annotations
import os
from enum import Enum

import httpx
from openai import AsyncOpenAI


class STTProvider(str, Enum):
    OPENAI = "openai"
    ELEVENLABS = "elevenlabs"


class STTManager:
    def __init__(self, provider: STTProvider = STTProvider.ELEVENLABS):
        self.provider = provider

    async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        """Transcribe audio bytes. Returns transcript string."""
        match self.provider:
            case STTProvider.OPENAI:
                return await self._openai(audio_bytes, filename, content_type)
            case STTProvider.ELEVENLABS:
                return await self._elevenlabs(audio_bytes, filename, content_type)

    async def _openai(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        result = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, content_type),
        )
        return result.text

    async def _elevenlabs(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        api_key = os.getenv("ELEVENLABS_API_KEY", "")
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers={"xi-api-key": api_key},
                files={
                    "file": (filename, audio_bytes, content_type),
                    "model_id": (None, "scribe_v2"),
                },
            )
            r.raise_for_status()
            return r.json()["text"]


def get_stt(provider: str | None = None) -> STTManager:
    """Return an STTManager. Reads STT_PROVIDER env var; defaults to elevenlabs."""
    p = STTProvider(provider or os.environ.get("STT_PROVIDER", "elevenlabs"))
    return STTManager(provider=p)
