from __future__ import annotations
from tools.tts_manager import get_tts

# In-memory interrupt flags per session
_interrupt_flags: dict[str, bool] = {}


def set_interrupt(session_id: str) -> None:
    _interrupt_flags[session_id] = True


def clear_interrupt(session_id: str) -> None:
    _interrupt_flags[session_id] = False


def is_interrupted(session_id: str) -> bool:
    return _interrupt_flags.get(session_id, False)


async def generate_tts(text: str, session_id: str) -> str | None:
    """
    Generate TTS audio via the configured provider.
    Returns base64-encoded MP3, or None on failure or interrupt.
    """
    clear_interrupt(session_id)
    manager = get_tts()
    audio = await manager.synthesize(text, session_id)
    if is_interrupted(session_id):
        return None
    return audio


# Anthropic tool schema definition
TTS_TOOL_SCHEMA = {
    "name": "generate_speech",
    "description": (
        "Convert text to spoken audio. Use this to vocalize the current interview question. "
        "Returns base64-encoded MP3 audio. If synthesis fails, the question text is used as fallback."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "The text to synthesize into speech.",
            },
            "session_id": {
                "type": "string",
                "description": "Session ID for interrupt tracking.",
            },
        },
        "required": ["text", "session_id"],
    },
}
