# Audio & LLM Adapter Pattern Design

**Date:** 2026-04-24  
**Status:** Approved

## Summary

Refactor TTS and STT from single-class `match/case` dispatch into a proper adapter pattern mirroring the existing LLM module. Add Grok (xAI) as a provider for LLM, TTS, and STT. Add Deepgram as a TTS and STT provider. Change TTS and STT defaults from OpenAI to ElevenLabs.

---

## Architecture

Three adapter modules sit as peers at the backend root:

```
backend/
  llm/                         # existing — add grok.py only
    base.py
    manager.py
    providers/
      anthropic.py
      openai.py
      google.py
      ollama.py
      grok.py                  # NEW
  tts/                         # NEW
    __init__.py
    base.py
    manager.py
    providers/
      __init__.py
      openai.py
      elevenlabs.py
      deepgram.py
      grok.py
  stt/                         # NEW
    __init__.py
    base.py
    manager.py
    providers/
      __init__.py
      openai.py
      elevenlabs.py
      deepgram.py
      grok.py
  tools/
    tts.py                     # update import: tts_manager → tts.manager
    tts_manager.py             # DELETED
    stt_manager.py             # DELETED
```

Each module follows the same internal shape:
- `base.py` — abstract base class (ABC)
- `manager.py` — manager class + `get_*()` factory that reads env var
- `providers/` — one file per provider, each implementing the ABC

No behavioral changes to public API (`api/tts.py`, `tools/tts.py`, agent callers).

---

## TTS Adapter

### `tts/base.py`

```python
from abc import ABC, abstractmethod

class BaseTTSProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str) -> bytes | None:
        """Return raw MP3 bytes, or None on any failure."""
        ...
```

### `tts/manager.py`

```python
class TTSProvider(str, Enum):
    OPENAI = "openai"
    ELEVENLABS = "elevenlabs"
    DEEPGRAM = "deepgram"
    GROK = "grok"

class TTSManager:
    def __init__(self, provider: TTSProvider = TTSProvider.ELEVENLABS):
        self.provider = provider
        self._provider: BaseTTSProvider = _build_provider(provider)

    async def synthesize(self, text: str, session_id: str) -> str | None:
        audio = await self._provider.synthesize(text)
        return base64.b64encode(audio).decode() if audio else None

def get_tts(provider: str | None = None) -> TTSManager:
    p = TTSProvider(provider or os.getenv("TTS_PROVIDER", "elevenlabs"))
    return TTSManager(provider=p)
```

Base64 encoding happens once in the manager — providers return raw bytes.

### TTS Providers

| Provider | Class | Endpoint | Key Env Vars | Default Voice |
|---|---|---|---|---|
| OpenAI | `OpenAITTSProvider` | `client.audio.speech.create` (SDK) | `OPENAI_API_KEY`, `OPENAI_TTS_VOICE` | `nova` |
| ElevenLabs | `ElevenLabsTTSProvider` | `POST /v1/text-to-speech/{voice_id}` | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | `EXAVITQu4vr4xnSDxMaL` |
| Deepgram | `DeepgramTTSProvider` | `POST /v1/speak?model={voice}` | `DEEPGRAM_API_KEY`, `DEEPGRAM_TTS_VOICE` | `aura-asteria-en` |
| Grok | `GrokTTSProvider` | `POST api.x.ai/v1/tts` | `XAI_API_KEY`, `GROK_TTS_VOICE` | `eve` |

All providers catch all exceptions and return `None` — TTS is optional audio enhancement; failures must not crash the session.

---

## STT Adapter

### `stt/base.py`

```python
from abc import ABC, abstractmethod

class BaseSTTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, filename: str, content_type: str) -> str:
        """Return transcript string. Raise on failure."""
        ...
```

STT providers raise on failure (unlike TTS) — transcription failure is a real error that the API layer should surface to the caller.

### `stt/manager.py`

```python
class STTProvider(str, Enum):
    OPENAI = "openai"
    ELEVENLABS = "elevenlabs"
    DEEPGRAM = "deepgram"
    GROK = "grok"

def get_stt(provider: str | None = None) -> STTManager:
    p = STTProvider(provider or os.getenv("STT_PROVIDER", "elevenlabs"))
    return STTManager(provider=p)
```

### STT Providers

| Provider | Class | Endpoint | Key Env Vars | Model/Notes |
|---|---|---|---|---|
| OpenAI | `OpenAISTTProvider` | `client.audio.transcriptions.create` (SDK) | `OPENAI_API_KEY` | `whisper-1` |
| ElevenLabs | `ElevenLabsSTTProvider` | `POST /v1/speech-to-text` (multipart) | `ELEVENLABS_API_KEY` | Scribe product |
| Deepgram | `DeepgramSTTProvider` | `POST /v1/listen` (multipart) | `DEEPGRAM_API_KEY`, `DEEPGRAM_STT_MODEL` | `nova-2` default |
| Grok | `GrokSTTProvider` | `POST api.x.ai/v1/stt` (multipart) | `XAI_API_KEY` | returns `{text}` |

---

## LLM Grok Extension

Grok's API is OpenAI-compatible, so `GrokProvider` reuses `AsyncOpenAI` with a custom `base_url`.

### `llm/providers/grok.py`

```python
class GrokProvider(BaseLLMProvider):
    def __init__(self, model: str) -> None:
        self.model = model

    async def complete(self, system, messages, max_tokens=512) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY", ""),
            base_url="https://api.x.ai/v1",
        )
        msgs = [{"role": "system", "content": system}] + messages
        response = await client.chat.completions.create(
            model=self.model, messages=msgs, max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()

    # complete_with_tools: falls back to base class plain completion (no native tool-use)
```

### Changes to `llm/manager.py`

- Add `GROK = "grok"` to `LLMProvider` enum
- Add `LLMProvider.GROK: "grok-3-mini"` to `_DEFAULT_MODELS`
- Add `case LLMProvider.GROK:` to `_build_provider()`

---

## Migration: Files to Delete

| File | Action |
|---|---|
| `backend/tools/tts_manager.py` | Delete — replaced by `tts/` module |
| `backend/tools/stt_manager.py` | Delete — replaced by `stt/` module |

## Migration: Files to Update

| File | Change |
|---|---|
| `backend/tools/tts.py` | `from tools.tts_manager import get_tts` → `from tts.manager import get_tts` |
| `backend/api/tts.py` | `from tools.stt_manager import get_stt` → `from stt.manager import get_stt` |

---

## Tests

### Update existing tests

- `tests/test_tts_manager.py` — update imports to `tts.manager`, update patch targets to `tts.providers.openai.AsyncOpenAI` / `tts.providers.elevenlabs.httpx.AsyncClient`; update default assertion from `OPENAI` → `ELEVENLABS`
- `tests/test_stt_manager.py` — update imports to `stt.manager`, update patch targets; update default assertion from `OPENAI` → `ELEVENLABS`

### New tests to add

- `tests/test_tts_deepgram.py` — synthesize returns base64, returns None on exception
- `tests/test_tts_grok.py` — synthesize returns base64, returns None on exception
- `tests/test_stt_elevenlabs.py` — transcribe returns text, raises on failure
- `tests/test_stt_deepgram.py` — transcribe returns text, raises on failure
- `tests/test_stt_grok.py` — transcribe returns text, raises on failure
- `tests/test_llm_grok.py` — complete returns stripped text

---

## Environment Variables Reference

```
# LLM
LLM_PROVIDER=anthropic|openai|google|ollama|grok
XAI_API_KEY=...          # used by both Grok LLM and Grok TTS/STT

# TTS
TTS_PROVIDER=elevenlabs|openai|deepgram|grok   # default: elevenlabs
OPENAI_TTS_VOICE=nova
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
DEEPGRAM_TTS_VOICE=aura-asteria-en
GROK_TTS_VOICE=eve

# STT
STT_PROVIDER=elevenlabs|openai|deepgram|grok   # default: elevenlabs
DEEPGRAM_STT_MODEL=nova-2
```
