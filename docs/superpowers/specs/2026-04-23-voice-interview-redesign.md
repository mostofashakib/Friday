# Voice Interview Redesign — Design Spec

**Date:** 2026-04-23
**Status:** Approved

---

## Overview

Redesign the active interview session (`/interview/[sessionId]`) to be fully voice-driven with a breathing orb as the visual centrepiece. Replace ElevenLabs TTS with OpenAI TTS. Remove all text input — candidates must speak. Add Web Speech API real-time transcript display with OpenAI Whisper used for the final submitted answer.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| TTS provider | OpenAI (`tts-1`, voice `nova`) |
| STT display | Web Speech API (real-time, shows as they talk) |
| STT submission | OpenAI Whisper (`whisper-1`) via new backend endpoint |
| Layout | Hero orb above question card |
| Text input | Removed — voice only |
| Silence threshold | 2 seconds of no new words → start countdown |
| Countdown duration | 5 seconds (cancellable by speaking again) |

---

## Backend Changes

### 1. Replace ElevenLabs TTS — `backend/tools/tts.py`

Remove all ElevenLabs code. Implement `generate_tts` using the OpenAI audio speech API.

```python
async def generate_tts(text: str, session_id: str) -> str | None:
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = await client.audio.speech.create(
        model="tts-1",
        voice="nova",       # warm, clear, professional
        input=text,
        response_format="mp3",
    )
    audio_bytes = response.content
    return base64.b64encode(audio_bytes).decode("utf-8")
```

- Remove `ELEVENLABS_API_KEY` from `.env`
- Remove `httpx` call to ElevenLabs
- Keep interrupt logic (`_interrupt_flags`) unchanged
- Fallback: return `None` on any error (caller already handles this gracefully)

### 2. New Whisper transcription endpoint — `backend/api/tts.py`

Add `POST /tts/transcribe` that accepts a multipart audio file and returns the Whisper transcript.

```
POST /tts/transcribe
Content-Type: multipart/form-data
Body: { audio: File (webm/ogg/mp4), session_id: str }

Response: { transcript: str }
```

Implementation:
```python
@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), session_id: str = Form(...)):
    audio_bytes = await audio.read()
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    result = await client.audio.transcriptions.create(
        model="whisper-1",
        file=(audio.filename or "audio.webm", audio_bytes, audio.content_type),
    )
    return {"transcript": result.text}
```

### 3. `backend/.env` — key changes

Remove:
```
ELEVENLABS_API_KEY=...
```

`OPENAI_API_KEY` already present — used for both RAG embeddings and TTS/Whisper.

---

## Frontend Changes

### 4. New `VoiceOrb` component — `frontend/components/interview/VoiceOrb.tsx`

A self-contained orb with four visual states driven by a `state` prop:

| `state` prop | Colour | Animation | Meaning |
|---|---|---|---|
| `"idle"` | Grey, dim | Slow float (4s) | Waiting to start |
| `"ai-speaking"` | Blue (#0A84FF) | Slow breathe (2.4s) | OpenAI TTS playing |
| `"user-speaking"` | Purple (#8C64FF) | Fast pulse (0.85s) | Mic active, candidate talking |
| `"countdown"` | Amber (#FF9F0A) | Slow breathe (2.4s) | Silence detected, submitting soon |

Props:
```ts
interface VoiceOrbProps {
  state: "idle" | "ai-speaking" | "user-speaking" | "countdown";
  onInterrupt?: () => void;   // tapped while ai-speaking
}
```

The orb is always rendered (hero position, ~88px core). Status text and sub-label render below it. Tapping during `ai-speaking` calls `onInterrupt`.

### 5. New `VoiceRecorder` hook — `frontend/hooks/useVoiceRecorder.ts`

Encapsulates all recording and transcription logic. Returns state + controls to the page.

**Responsibilities:**
- Manages `SpeechRecognition` for live transcript display
- Runs `MediaRecorder` in parallel to capture raw audio (webm)
- Detects silence: when no new words arrive for **2 seconds**, start the 5s countdown timer
- If new words arrive during countdown → cancel countdown, resume recording
- On countdown expiry → stop both recognisers, POST audio blob to `/api/tts/transcribe`, call `onSubmit(whisperTranscript)`
- Exposes `cancel()` to let the user explicitly cancel the countdown

**Returned interface:**
```ts
{
  liveTranscript: string;         // Web Speech API interim text
  recorderState: "idle" | "listening" | "countdown";
  countdownSeconds: number;       // 5 → 0 during countdown
  start: () => void;
  cancel: () => void;             // cancels countdown, keeps recording
  isSupported: boolean;
}
```

**Audio format:** `MediaRecorder` uses `audio/webm` (Chrome) or `audio/ogg` (Firefox). Both accepted by Whisper.

### 6. Rewrite interview session page — `frontend/app/interview/[sessionId]/page.tsx`

Remove `AudioRecorder` and `TTSPlayer` from the page entirely. Replace with `VoiceOrb` and `useVoiceRecorder`.

**New layout (right column, top to bottom):**
1. Progress / difficulty bar (unchanged)
2. **Hero orb section** — `VoiceOrb` + status label + sub-label
3. Question card (unchanged)
4. Live transcript panel — shows `liveTranscript` while `user-speaking`; locked text while `countdown`
5. Countdown strip — visible only during `countdown` state, shows 5s timer bar + Cancel button

**State machine (page-level):**
```
idle
  → [TTS audio received] → ai-speaking
      → [TTS ends / interrupted] → user-speaking (auto-start recording)
          → [2s silence] → countdown
              → [new speech] → user-speaking (cancel countdown)
              → [5s expires] → submitting → idle (wait for next question)
```

**Voice-only enforcement:** The textarea, Record button, and Submit button are completely removed. The only way to submit is via the voice flow above.

### 7. `frontend/lib/api.ts` — new `transcribeAudio` function

```ts
export async function transcribeAudio(blob: Blob, sessionId: string): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "answer.webm");
  form.append("session_id", sessionId);
  const res = await fetch("/api/tts/transcribe", { method: "POST", body: form });
  if (!res.ok) throw new Error("Transcription failed");
  const { transcript } = await res.json();
  return transcript;
}
```

### 8. Remove `AudioRecorder` component

`frontend/components/interview/AudioRecorder.tsx` — delete. No longer used anywhere.

---

## Data Flow (one full turn)

```
1. Previous answer submitted → backend returns { question, tts_audio }
2. Page sets orbState = "ai-speaking", plays base64 MP3
3. TTS ends → page sets orbState = "user-speaking", calls recorder.start()
4. MediaRecorder + SpeechRecognition both active
5. Live transcript renders below question card
6. 2s silence detected → orbState = "countdown", 5s timer starts
7. [candidate keeps talking] → countdown cancelled, back to step 4
8. [5s expires] → MediaRecorder stopped, audio blob sent to /api/tts/transcribe
9. Whisper returns final transcript
10. Page calls submitTurn(sessionId, whisperTranscript)
11. orbState = "idle" while backend processes
12. Response arrives → repeat from step 2
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/tools/tts.py` | Replace ElevenLabs with OpenAI TTS |
| `backend/api/tts.py` | Add `POST /tts/transcribe` (Whisper) |
| `backend/.env` | Remove `ELEVENLABS_API_KEY` |
| `frontend/components/interview/VoiceOrb.tsx` | New — breathing orb component |
| `frontend/hooks/useVoiceRecorder.ts` | New — MediaRecorder + Web Speech + silence detection |
| `frontend/app/interview/[sessionId]/page.tsx` | Rewire layout, orb, voice flow |
| `frontend/lib/api.ts` | Add `transcribeAudio()` |
| `frontend/components/interview/AudioRecorder.tsx` | Delete |

Files not touched: `TTSPlayer.tsx`, `QuestionCard.tsx`, `TranscriptPanel.tsx`, `DifficultyMeter.tsx`, grader/coach/interviewer agents, DB layer.

---

## Error Handling

| Failure | Behaviour |
|---------|-----------|
| OpenAI TTS fails | `tts_audio` is `null` → orb skips ai-speaking, goes straight to user-speaking |
| Whisper transcription fails | Fall back to Web Speech API `liveTranscript` as the submitted answer |
| Web Speech API not supported | Show a browser-not-supported message; Whisper-only path still works |
| MediaRecorder not supported | Disable Whisper fallback; use Web Speech API transcript only |
| Microphone permission denied | Show clear error under the orb; disable recording |
