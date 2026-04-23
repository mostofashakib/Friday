import base64
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_openai_provider_returns_base64_audio():
    """TTSManager with openai provider encodes API response as base64."""
    from tools.tts_manager import TTSManager, TTSProvider

    fake_audio = b"fake-mp3-bytes"
    mock_response = MagicMock()
    mock_response.content = fake_audio

    mock_client = AsyncMock()
    mock_client.audio.speech.create = AsyncMock(return_value=mock_response)

    with patch("tools.tts_manager.AsyncOpenAI", return_value=mock_client):
        manager = TTSManager(provider=TTSProvider.OPENAI)
        result = await manager.synthesize("Hello", "session-1")

    assert result == base64.b64encode(fake_audio).decode("utf-8")


@pytest.mark.asyncio
async def test_openai_provider_returns_none_on_exception():
    """TTSManager swallows OpenAI errors and returns None."""
    from tools.tts_manager import TTSManager, TTSProvider

    mock_client = AsyncMock()
    mock_client.audio.speech.create = AsyncMock(side_effect=Exception("API error"))

    with patch("tools.tts_manager.AsyncOpenAI", return_value=mock_client):
        manager = TTSManager(provider=TTSProvider.OPENAI)
        result = await manager.synthesize("Hello", "session-1")

    assert result is None


@pytest.mark.asyncio
async def test_elevenlabs_provider_returns_base64_audio():
    """TTSManager with elevenlabs provider encodes HTTP response as base64."""
    from tools.tts_manager import TTSManager, TTSProvider

    fake_audio = b"fake-mp3-bytes"
    mock_response = MagicMock()
    mock_response.content = fake_audio
    mock_response.raise_for_status = MagicMock()

    mock_http_client = AsyncMock()
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)
    mock_http_client.post = AsyncMock(return_value=mock_response)

    with patch("tools.tts_manager.httpx.AsyncClient", return_value=mock_http_client):
        manager = TTSManager(provider=TTSProvider.ELEVENLABS)
        result = await manager.synthesize("Hello", "session-1")

    assert result == base64.b64encode(fake_audio).decode("utf-8")


@pytest.mark.asyncio
async def test_elevenlabs_provider_returns_none_on_exception():
    """TTSManager swallows ElevenLabs errors and returns None."""
    from tools.tts_manager import TTSManager, TTSProvider

    mock_http_client = AsyncMock()
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)
    mock_http_client.post = AsyncMock(side_effect=Exception("network error"))

    with patch("tools.tts_manager.httpx.AsyncClient", return_value=mock_http_client):
        manager = TTSManager(provider=TTSProvider.ELEVENLABS)
        result = await manager.synthesize("Hello", "session-1")

    assert result is None


def test_get_tts_defaults_to_openai(monkeypatch):
    """get_tts() picks openai when TTS_PROVIDER env var is not set."""
    from tools.tts_manager import get_tts, TTSProvider
    monkeypatch.delenv("TTS_PROVIDER", raising=False)
    manager = get_tts()
    assert manager.provider == TTSProvider.OPENAI


def test_get_tts_respects_env_var(monkeypatch):
    """get_tts() picks the provider set in TTS_PROVIDER."""
    from tools.tts_manager import get_tts, TTSProvider
    monkeypatch.setenv("TTS_PROVIDER", "elevenlabs")
    manager = get_tts()
    assert manager.provider == TTSProvider.ELEVENLABS
