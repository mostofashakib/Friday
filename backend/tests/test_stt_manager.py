import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_openai_provider_returns_transcript():
    """STTManager with openai provider returns the Whisper transcript text."""
    from tools.stt_manager import STTManager, STTProvider

    mock_result = MagicMock()
    mock_result.text = "I led the team through the incident."

    mock_client = AsyncMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)

    with patch("tools.stt_manager.AsyncOpenAI", return_value=mock_client):
        manager = STTManager(provider=STTProvider.OPENAI)
        result = await manager.transcribe(b"audio-bytes", "audio.webm", "audio/webm")

    assert result == "I led the team through the incident."
    mock_client.audio.transcriptions.create.assert_awaited_once_with(
        model="whisper-1",
        file=("audio.webm", b"audio-bytes", "audio/webm"),
    )


@pytest.mark.asyncio
async def test_openai_provider_passes_filename_and_content_type():
    """STTManager passes filename and content_type to the Whisper API."""
    from tools.stt_manager import STTManager, STTProvider

    mock_result = MagicMock()
    mock_result.text = "Hello"

    mock_client = AsyncMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)

    with patch("tools.stt_manager.AsyncOpenAI", return_value=mock_client):
        manager = STTManager(provider=STTProvider.OPENAI)
        await manager.transcribe(b"bytes", "answer.ogg", "audio/ogg")

    call_kwargs = mock_client.audio.transcriptions.create.call_args
    assert call_kwargs.kwargs["file"] == ("answer.ogg", b"bytes", "audio/ogg")


def test_get_stt_defaults_to_openai(monkeypatch):
    """get_stt() picks openai when STT_PROVIDER is not set."""
    from tools.stt_manager import get_stt, STTProvider
    monkeypatch.delenv("STT_PROVIDER", raising=False)
    manager = get_stt()
    assert manager.provider == STTProvider.OPENAI


def test_get_stt_respects_env_var(monkeypatch):
    """get_stt() reads STT_PROVIDER env var."""
    from tools.stt_manager import get_stt, STTProvider
    monkeypatch.setenv("STT_PROVIDER", "openai")
    manager = get_stt()
    assert manager.provider == STTProvider.OPENAI
