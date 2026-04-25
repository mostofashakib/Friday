<div align="center">

# Friday — AI Interview Coach

**Practice behavioral interviews with a voice-first AI coach**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![LangGraph](https://img.shields.io/badge/Multi--Agent-LangGraph-green)](https://langchain-ai.github.io/langgraph/)
[![Ollama](https://img.shields.io/badge/Default%20LLM-Ollama-black)](https://ollama.com)

[Features](#features) · [Architecture](#architecture) · [Getting Started](#getting-started) · [API Reference](#api-reference) · [Deployment](#deployment)

</div>

---

## What is Friday?

**Friday** is a full-stack AI mock interview simulator. It conducts adaptive behavioral interviews entirely through voice — Friday speaks questions aloud, listens to your answers, grades every response in real time, and gives specific coaching feedback at the end. Under the hood, five specialized AI agents collaborate via a LangGraph pipeline to keep the session coherent and calibrated to your level.

**Default stack:** Ollama (local LLM) · ElevenLabs TTS/STT · LangGraph · FastAPI · Next.js · Supabase

---

## Features

### Voice-First Interaction

The interview runs entirely through voice with no manual input required:

- **Tap to begin** — a blue orb greets you on load; tapping it triggers Friday's spoken introduction and reveals the first question
- **Friday speaks every question** — each question is synthesized via ElevenLabs TTS and played through the browser before the microphone opens
- **Real-time voice activity detection** — the Web Audio API `AnalyserNode` samples microphone amplitude at 100 ms intervals; 5 seconds of measured silence (RMS below threshold) starts the countdown
- **Countdown to submit** — a 5-second visual countdown appears after silence is detected; speaking at any point cancels it and resets the clock
- **Live transcript** — Web Speech API shows a real-time preview of what you're saying while the countdown is running
- **Server-side transcription** — the final audio is transcribed by ElevenLabs Scribe v2 for accuracy; falls back to the Web Speech transcript if STT fails
- **Interrupt** — tap the animated orb while Friday is speaking to cut in immediately and start recording
- **Question card** — the current question is displayed in text form beneath the orb once the session begins (not before)
- **Configurable TTS provider** — defaults to ElevenLabs (`eleven_turbo_v2`); swap to OpenAI TTS via `TTS_PROVIDER=openai`
- **Configurable STT provider** — defaults to ElevenLabs Scribe v2; swap to OpenAI Whisper via `STT_PROVIDER=openai`

### Five-Agent Interview Pipeline

A stateful LangGraph pipeline where five specialized agents share session memory:

| Agent | Trigger | Role |
|---|---|---|
| **Interviewer** | Start + after each graded turn | Selects a calibrated question from the 135-question bank. Follows Coach directives. |
| **Grader** | Every user answer | Scores 1–5, identifies the competency being tested, lists strengths and gaps. |
| **Clarifier** | Score ≤ 2 | Generates a probing follow-up to test foundational understanding of the weak area. |
| **Followup** | Score 3–4 | Runs RAG over prior answers. Triggers a targeted follow-up when a recurring gap is found. |
| **Coach** | After most turns | Bans saturated competencies, writes directives for the Interviewer, collects coaching notes for the final report. |

### Conditional Routing

```
Your answer
      │
      ▼
   Grader
      │
   score?
   ├─ 1–2 ──▶ Clarifier ──▶ Coach ──▶ Interviewer (probe)
   ├─ 3–4 ──▶ Followup ──▶ gap found? ──▶ Interviewer (targeted follow-up)
   │                     └─ no gap   ──▶ Coach ──▶ Interviewer (next question)
   └─ 5   ─────────────────────────────▶ Coach ──▶ Interviewer (harder question)
```

### Personalized Candidate Context

Before the first question, Friday optionally builds a candidate profile from up to four sources (fetched concurrently):

| Source | What it does |
|---|---|
| **GitHub username** | Fetches repos, LLM-summarizes each, builds an engineering profile |
| **Google Scholar name** | Pulls publications via `scholarly`, summarizes research background |
| **Resume file** | Extracts text from PDF or plain text, LLM-summarizes |
| **Job posting URL** | Fetches page, strips HTML, extracts role requirements |

All context is injected into the Interviewer's system prompt so questions are anchored to your actual background.

### Difficulty Calibration

- 5 levels: Entry → Junior → Mid → Senior → Staff
- Auto-adjusts up when your rolling average score ≥ 4.0, down when ≤ 2.0
- Per-competency question budget prevents any single topic from dominating

### RAG Gap Detection

Every answer is embedded (`text-embedding-3-small`) and stored in Supabase pgvector. The Followup agent runs a semantic similarity search over the session's prior Q&A to surface recurring weak areas before generating a follow-up question.

### Multi-Provider LLM Support

```
LLM_PROVIDER=ollama      → gemma4:26b (default, local — requires Ollama running)
LLM_PROVIDER=anthropic   → Claude Haiku 4.5
LLM_PROVIDER=openai      → GPT-4o Mini
LLM_PROVIDER=google      → Gemini 1.5 Flash
```

Each provider is a separate class implementing `BaseLLMProvider`. Switching providers is a single env var change — no code changes required. Ollama's thinking/reasoning mode is disabled by default (`think: false`) so questions are generated directly without token-budget issues.

### Post-Session Report

After all turns, Friday generates a report with:
- Overall score (1–5) with qualitative label (Strong / Solid / Needs work)
- Competency breakdown — score and attempt count per topic
- Coaching insights — the Coach's notes collected across the session
- Full transcript — every question and answer

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                             │
│                                                                        │
│   Landing Page    Interview Setup    Active Session    Report          │
│                   GitHub / Scholar   VoiceOrb UI      Scores/Notes    │
│                   Resume / Job URL   VAD silence det.  Transcript     │
│                                                                        │
│   Web Audio API (VAD)  Web Speech API (live transcript)               │
│   ElevenLabs TTS · ElevenLabs STT · catch-all API proxy route        │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ HTTP / REST (multipart + JSON)
                              │ via Next.js catch-all /api/[...path]
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  API Layer (FastAPI — thin HTTP handlers)             │
│                                                                        │
│  POST /sessions            POST /sessions/{id}/start                 │
│  POST /sessions/{id}/turn  GET  /sessions/{id}/report                │
│  POST /tts                 POST /tts/interrupt                        │
│  POST /tts/transcribe                                                 │
│                                                                        │
│  Validates requests · persists to DB · synthesizes TTS · responds    │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ calls
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│              agents/orchestrator.py  (pure pipeline logic)           │
│                                                                        │
│  Interviewer ──▶ Grader ──▶ [Clarifier | Followup] ──▶ Coach        │
│      ▲_______________________________________________│                │
│                                                                        │
│  No DB · No HTTP · No audio — returns TurnResult dataclass           │
└──────────────┬────────────────────────────┬──────────────────────────┘
               │ uses                       │ uses
               ▼                            ▼
┌─────────────────────────┐   ┌────────────────────────────────────────┐
│  llm/  (adapter pattern) │   │  tools/                               │
│                          │   │                                        │
│  base.py  BaseLLMProvider│   │  question_bank.py  135-Q bank + lookup│
│  providers/              │   │  agent_tools.py    schemas + executor  │
│    anthropic.py          │   │  tts_manager.py    TTS adapter         │
│    openai.py             │   │  stt_manager.py    STT adapter         │
│    google.py             │   │  github / scholar / resume / scraper   │
│    ollama.py  (default)  │   └────────────────────────────────────────┘
│  manager.py  factory     │
└─────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL + pgvector)                     │
│                                                                        │
│   sessions   messages   message_embeddings   competency_scores        │
│   Row Level Security — users access only their own sessions           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 App Router, Tailwind CSS v4, TypeScript |
| **Backend** | FastAPI, Python 3.11+, uvicorn |
| **Agent Orchestration** | LangGraph (stateful multi-agent with conditional edges) |
| **LLM** | Ollama `gemma4:26b` (default, local) — Anthropic Claude, OpenAI, Google Gemini supported |
| **TTS** | ElevenLabs `eleven_turbo_v2` (default) — OpenAI `tts-1` as alternative |
| **STT** | ElevenLabs Scribe v2 (server-side, default) — OpenAI Whisper as alternative; Web Speech API for live display |
| **Voice Activity Detection** | Web Audio API `AnalyserNode` — 100 ms RMS sampling, 5 s silence threshold |
| **RAG Embeddings** | OpenAI `text-embedding-3-small` |
| **Vector Store** | Supabase pgvector |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (bypassable via `AUTH_ENABLED` flag) |
| **Frontend Proxy** | Next.js catch-all API route (`/api/[...path]`) — avoids stale keep-alive connection issues |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | GCP Cloud Run |

---

## Code Design

### LLM Adapter Pattern

Every LLM provider implements `BaseLLMProvider` in `llm/base.py`:

```python
class BaseLLMProvider(ABC):
    async def complete(self, system, messages, max_tokens) -> str: ...
    async def complete_with_tools(self, system, messages, tools, tool_executor, ...) -> str:
        # Default: fall back to plain completion
        # Ollama overrides this to strip tool-call syntax and inject a no-tool instruction
        return await self.complete(system, messages, max_tokens)
```

`llm/manager.py` is a thin factory — it reads `LLM_PROVIDER`, constructs the right provider class, and delegates all calls to it. Swapping providers is a single env var change. Adding a new one means creating one file in `llm/providers/` and one `case` in `_build_provider()`.

**Ollama-specific behaviour:** `gemma4:26b` uses a thinking/reasoning mode that can exhaust its token budget before producing output. The Ollama provider sends `think: false` to disable this, falls back to the `thinking` field if `content` is empty, and strips any tool-call syntax from responses since Ollama doesn't execute tools natively.

### Voice Activity Detection

Silence detection is driven by the **Web Audio API**, not the Web Speech API:

```
getUserMedia stream
      │
      ▼
AudioContext → AnalyserNode (fftSize 512)
      │
      ▼  every 100 ms
  getRMS() → compare against SILENCE_THRESHOLD (0.01)
      │
  speaking?  ──yes──▶ reset silence clock · cancel any active countdown
      │
  silent ≥ 5 s ────▶ start 5-second countdown · submit on zero
```

This makes silence detection independent of speech recognition latency. The Web Speech API is kept solely for the live transcript display.

### Agent Pipeline Separation

The agent pipeline (`agents/orchestrator.py`) is decoupled from HTTP and database concerns:

| Layer | File | Responsibility |
|---|---|---|
| HTTP | `api/sessions.py` | Request validation, DB persistence, TTS synthesis, response formatting |
| Pipeline | `agents/orchestrator.py` | Agent routing, trace building — returns `TurnResult` dataclass |
| Agents | `agents/*.py` | Single-purpose LLM calls (grading, coaching, question selection, etc.) |

`run_turn(state)` in the orchestrator has no DB calls and no audio synthesis. The API layer owns those side effects and calls the orchestrator as a black box.

### Frontend Proxy

All frontend API calls go through a Next.js catch-all route at `app/api/[...path]/route.ts`, which proxies to the FastAPI backend. This avoids the stale keep-alive connection issues (`ECONNRESET`) that arise when using Next.js `rewrites` as a proxy.

---

## Project Structure

```
Friday/
├── run.sh              Start backend + frontend
├── kill.sh             Stop all Friday processes
├── setup.sh            First-time setup (venv, npm install, .env files)
├── deploy.sh           Build + push to GCP, deploy to Cloud Run + Vercel
│
├── backend/
│   ├── main.py                  FastAPI app entry point
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   ├── agents/
│   │   ├── state.py             InterviewState TypedDict (shared across all agents)
│   │   ├── graph.py             LangGraph graph definition + routing functions
│   │   ├── orchestrator.py      Pipeline runner — routes agents, builds trace, no DB/HTTP
│   │   ├── interviewer.py       Question selection (LLM + optional tool use)
│   │   ├── grader.py            Answer scoring (1–5, competency, gaps) + score aggregation
│   │   ├── clarifier.py         Probing questions for score ≤ 2
│   │   ├── followup.py          RAG-driven targeted follow-ups for score 3–4
│   │   └── coach.py             Coaching notes + difficulty calibration + competency bans
│   │
│   ├── tools/
│   │   ├── question_bank.py     135-question bank, competency lookup, normalization
│   │   ├── agent_tools.py       Tool schemas (JSON), state mutators, executor factory
│   │   ├── tts.py               TTS generation + interrupt flag logic
│   │   ├── tts_manager.py       TTS provider adapter (ElevenLabs default / OpenAI)
│   │   ├── stt_manager.py       STT provider adapter (ElevenLabs Scribe default / Whisper)
│   │   ├── github.py            GitHub repo fetch + LLM summarization
│   │   ├── scholar.py           Google Scholar publication lookup
│   │   ├── resume.py            PDF / text resume extraction
│   │   └── job_scraper.py       Job posting URL scraper
│   │
│   ├── llm/
│   │   ├── base.py              BaseLLMProvider ABC + ToolExecutor type
│   │   ├── manager.py           Factory (get_llm) + thin LLMManager wrapper
│   │   └── providers/
│   │       ├── anthropic.py     Claude — full tool-use loop
│   │       ├── openai.py        GPT — plain completion
│   │       ├── google.py        Gemini — chat session
│   │       └── ollama.py        Ollama — local httpx, think:false, tool-call stripping
│   │
│   ├── rag/
│   │   ├── embeddings.py        OpenAI text-embedding-3-small
│   │   └── retriever.py         pgvector similarity search
│   │
│   ├── db/
│   │   ├── client.py            Supabase client singleton
│   │   ├── queries.py           All database helpers
│   │   └── schema.sql           Run once in Supabase SQL editor
│   │
│   ├── api/
│   │   ├── sessions.py          Thin HTTP handlers — delegates to orchestrator
│   │   └── tts.py               TTS synthesis, interrupt, and transcription endpoints
│   │
│   └── utils/
│       └── json_utils.py        parse_llm_json — strips markdown fences, safe fallback
│
└── frontend/
    ├── app/
    │   ├── layout.tsx            Root layout + SEO metadata
    │   ├── page.tsx              Landing page
    │   ├── globals.css           Design system (glassmorphism + orb animations)
    │   ├── api/[...path]/        Catch-all proxy route to FastAPI backend
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── interview/
    │   │   ├── setup/page.tsx    Interview configuration + context upload
    │   │   └── [sessionId]/page.tsx  Active session (voice-first, tap-to-start)
    │   └── report/
    │       └── [sessionId]/page.tsx  Post-session coaching report
    │
    ├── components/
    │   ├── landing/              Hero, Features, HowItWorks, CTA
    │   ├── layout/               Navbar, Footer
    │   └── interview/
    │       ├── VoiceOrb.tsx      Animated orb (ready / idle / ai-speaking / user-speaking / countdown)
    │       ├── DifficultyMeter.tsx  Progress bar + difficulty dots
    │       ├── QuestionCard.tsx  Current question (shown after session starts)
    │       └── TranscriptPanel.tsx  Full Q&A transcript (report page)
    │
    ├── hooks/
    │   └── useVoiceRecorder.ts  Web Audio VAD + MediaRecorder + ElevenLabs STT submission
    │
    └── lib/
        ├── api.ts                Backend API client
        ├── auth-config.ts        AUTH_ENABLED single source of truth
        ├── supabase.ts           Supabase browser client
        └── supabase-server.ts    Supabase server client
```

---

## Getting Started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | |
| Node.js | 18+ | |
| npm | 9+ | |
| Ollama | latest | Required for default LLM — [install here](https://ollama.com) |

### 1. Clone and set up

```bash
git clone https://github.com/yourusername/friday.git
cd friday
bash setup.sh
```

`setup.sh` creates a Python virtual environment, installs backend dependencies, installs frontend npm packages, and copies `.env.example` files for you to fill in.

### 2. Pull the default model (Ollama)

```bash
ollama pull gemma4:26b
```

To use a different LLM instead, set `LLM_PROVIDER` in `backend/.env` (see below).

### 3. Fill in your environment variables

Open `backend/.env` and add your API keys (see [Environment Variables](#environment-variables) below).

### 4. Set up the database

Run `backend/db/schema.sql` in the Supabase SQL editor of your project. This creates the four tables Friday needs.

### 5. Start the app

```bash
bash run.sh
```

- **Frontend** → http://localhost:3000
- **Backend** → http://localhost:8000
- **API Docs** → http://localhost:8000/docs

Press `Ctrl+C` to stop both servers.

```bash
bash kill.sh   # force-stop if needed
```

### Auth bypass (development)

Set `AUTH_ENABLED = false` in `frontend/lib/auth-config.ts` to skip Supabase Auth entirely. The app routes directly to `/interview/setup` with no login required.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service role key (server-only) |
| `CORS_ORIGINS` | ✅ | — | Comma-separated allowed origins (e.g. `http://localhost:3000`) |
| `ELEVENLABS_API_KEY` | ✅ | — | Required for TTS and STT (defaults) |
| `ELEVENLABS_VOICE_ID` | ❌ | `EXAVITQu4vr4xnSDxMaL` | ElevenLabs voice ID |
| `OPENAI_API_KEY` | ❌ | — | Required for RAG embeddings and if using OpenAI TTS/STT/LLM |
| `ANTHROPIC_API_KEY` | ❌ | — | Required only if `LLM_PROVIDER=anthropic` |
| `TTS_PROVIDER` | ❌ | `elevenlabs` | `elevenlabs` \| `openai` |
| `STT_PROVIDER` | ❌ | `elevenlabs` | `elevenlabs` \| `openai` |
| `LLM_PROVIDER` | ❌ | `ollama` | `ollama` \| `anthropic` \| `openai` \| `google` |
| `OLLAMA_BASE_URL` | ❌ | `http://localhost:11434` | Ollama server URL |
| `MAX_TURNS` | ❌ | `8` | Interview length in turns |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Same Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | ❌ | Canonical URL for SEO metadata |

> **Note:** The frontend no longer needs `NEXT_PUBLIC_API_URL`. All API calls are proxied through the Next.js catch-all route at `/api/[...path]`, which forwards to the FastAPI backend running on port 8000.

---

## API Reference

All endpoints accept an `X-User-Id` header (sent automatically by the frontend to scope sessions to a user).

### Sessions

```
POST  /sessions                  Create a session (multipart/form-data)
POST  /sessions/{id}/start       Get the first question (called before navigating to interview)
POST  /sessions/{id}/turn        Submit an answer → full agent pipeline
GET   /sessions/{id}/report      Post-session report (scores, notes, transcript)
GET   /sessions/{id}/history     Raw message history
```

**`POST /sessions`** — multipart form fields:

| Field | Type | Description |
|---|---|---|
| `interview_type` | string | `behavioral` |
| `difficulty` | int | 1–5 starting difficulty |
| `role` | string | Target job title (optional) |
| `github_username` | string | GitHub profile context (optional) |
| `scholar_name` | string | Google Scholar name (optional) |
| `job_url` | string | Job posting URL (optional) |
| `resume` | file | PDF or plain text (optional) |

**`POST /sessions/{id}/turn`** response:

```json
{
  "session_complete": false,
  "grading": {
    "score": 3,
    "competency": "problem_solving",
    "feedback": "Good framing. Push for more specificity.",
    "strengths": ["Clear structure"],
    "gaps": ["Missing quantified outcome"]
  },
  "coaching_note": "Next time, lead with the business impact.",
  "question": "Tell me about a time you made a decision with incomplete information.",
  "tts_audio": "<base64 MP3>",
  "turn": 3,
  "difficulty": 3,
  "is_followup": false,
  "route": "followup",
  "agent_trace": [
    { "node": "grader",      "decision": "score=3, competency=problem_solving" },
    { "node": "router",      "decision": "score=3 → routing to followup" },
    { "node": "followup",    "decision": "no recurring gap found, proceeding to coach" },
    { "node": "coach",       "decision": "rolling avg 3.2, difficulty held at 3" },
    { "node": "interviewer", "decision": "selecting next question at difficulty 3" }
  ]
}
```

### Voice (TTS / STT)

```
POST  /tts                   Synthesize text → base64 MP3
POST  /tts/interrupt         Cancel active TTS playback for a session
POST  /tts/transcribe        Transcribe audio file → transcript string
```

**`POST /tts/transcribe`** — multipart form:

| Field | Type | Description |
|---|---|---|
| `audio` | file | Audio file (webm, mp4, etc.) |
| `session_id` | string | Session identifier |

---

## Database Schema

Run `backend/db/schema.sql` in the Supabase SQL editor before first launch.

```
sessions             Interview sessions (type, role, difficulty, status, timestamps)
messages             All Q&A turns (role, content, score, competency, is_followup)
message_embeddings   pgvector 1536-dim embeddings for RAG gap detection
competency_scores    Rolling per-competency scores within a session
```

Row Level Security is enabled on all tables.

---

## Deployment

### One-command deploy

```bash
bash deploy.sh
```

Handles Docker build + push to Google Artifact Registry, `gcloud run deploy`, and `vercel --prod` in sequence.

### Backend → GCP Cloud Run (manual)

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/friday-backend ./backend

gcloud run deploy friday-backend \
  --image gcr.io/YOUR_PROJECT/friday-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "ELEVENLABS_API_KEY=...,OPENAI_API_KEY=...,SUPABASE_URL=...,LLM_PROVIDER=anthropic,ANTHROPIC_API_KEY=..."
```

> When deploying to Cloud Run, set `LLM_PROVIDER=anthropic` (or `openai`/`google`) since Ollama is a local-only server.

### Frontend → Vercel (manual)

```bash
cd frontend && vercel --prod
```

Set your Supabase environment variables in the Vercel project settings. No backend URL env var is needed — the catch-all proxy route always targets port 8000 in development and your Cloud Run URL in production (configure this in `app/api/[...path]/route.ts`).

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Developed by [Mostofa Shakib](https://www.mostofashakib.com)

</div>
