from __future__ import annotations
import base64
import os
from enum import Enum

import httpx
from openai import AsyncOpenAI


class TTSProvider(str, Enum):
    OPENAI = "openai"
    ELEVENLABS = "elevenlabs"


class TTSManager:
    def __init__(self, provider: TTSProvider = TTSProvider.OPENAI):
        self.provider = provider

    async def synthesize(self, text: str, session_id: str) -> str | None:
        """Return base64-encoded MP3, or None on any failure."""
        match self.provider:
            case TTSProvider.OPENAI:
                return await self._openai(text)
            case TTSProvider.ELEVENLABS:
                return await self._elevenlabs(text)

    async def _openai(self, text: str) -> str | None:
        try:
            client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            response = await client.audio.speech.create(
                model="tts-1",
                voice="nova",
                input=text,
                response_format="mp3",
            )
            return base64.b64encode(response.content).decode("utf-8")
        except Exception:
            return None

    async def _elevenlabs(self, text: str) -> str | None:
        try:
            api_key = os.getenv("ELEVENLABS_API_KEY", "")
            voice_id = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                    headers={"xi-api-key": api_key},
                    json={"text": text, "model_id": "eleven_turbo_v2"},
                )
                r.raise_for_status()
                return base64.b64encode(r.content).decode("utf-8")
        except Exception:
            return None


def get_tts(provider: str | None = None) -> TTSManager:
    """Return a TTSManager. Reads TTS_PROVIDER env var; defaults to elevenlabs."""
    p = TTSProvider(provider or os.environ.get("TTS_PROVIDER", "elevenlabs"))
    return TTSManager(provider=p)
