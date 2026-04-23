<div align="center">

# Friday — AI Mock Interview Coach

**Adaptive AI-powered behavioral interview practice with real-time coaching, voice interaction, and personalized candidate profiling.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-orange)](https://anthropic.com)
[![LangGraph](https://img.shields.io/badge/Multi--Agent-LangGraph-green)](https://langchain-ai.github.io/langgraph/)

[Features](#features) · [Architecture](#architecture) · [Getting Started](#getting-started) · [API Reference](#api-reference) · [Deployment](#deployment)

</div>

---

## What is Friday?

**Friday** is a full-stack AI mock interview simulator built on a stateful multi-agent pipeline (LangGraph + Claude). It conducts adaptive behavioral interviews, grades every answer in real time, detects recurring knowledge gaps via RAG, and gives specific per-turn coaching feedback — all with voice-first interaction.

> Built with: **Anthropic Claude** · **LangGraph** · **FastAPI** · **Next.js 14** · **Supabase pgvector** · **ElevenLabs TTS**

---

## Features

### Five-Agent Interview Pipeline

Friday runs a stateful LangGraph pipeline where five specialized AI agents share session memory and collaborate to run a coherent, calibrated interview:

| Agent | Trigger | Role |
|-------|---------|------|
| **Interviewer** | Start + after each graded turn | Selects calibrated questions from the curated bank using `search_question_bank` and `get_competency_history` tools. Follows Coach directives. |
| **Grader** | Every user answer | Scores the answer 1–5, identifies competency, lists strengths and gaps. Feeds into routing. |
| **Clarifier** | Score ≤ 2 | Generates a probing follow-up that tests foundational understanding of the weak area. |
| **Followup** | Score 3–4 | Runs RAG similarity search over prior answers. Triggers a targeted follow-up when recurring gaps are found. |
| **Coach** | After grading (most turns) | Bans saturated competencies, sets directives for the Interviewer, flags anomalies for human review, and produces a concise coaching note. |

### Conditional Agent Routing

```
Answer submitted
      │
      ▼
   Grader
      │
   score?
   ├─ 1–2 ──▶ Clarifier ──▶ Coach ──▶ Interviewer (probe question)
   ├─ 3–4 ──▶ Followup ──▶ (gap found?) ──▶ Interviewer (immediate follow-up)
   │                      └─ (no gap)  ──▶ Coach ──▶ Interviewer (next question)
   └─ 5   ─────────────────────────────▶ Coach ──▶ Interviewer (harder question)
```

### Agent Tool Use

Agents call structured tools mid-reasoning:

**Interviewer tools:**
- `search_question_bank(competency, difficulty)` — retrieves a curated question from the 135-question bank (9 competencies × 5 levels)
- `get_competency_history(competency)` — reads rolling score and attempt count before picking a topic

**Coach tools:**
- `ban_competency(competency, reason)` — marks a topic as saturated; Interviewer skips it
- `set_directive(directive)` — writes a specific instruction the Interviewer must follow next turn
- `flag_for_human_review(reason, severity)` — escalates the session when anomalies are detected

### Coach-Driven Session State

The Coach mutates live session state that the Interviewer reads every turn:

```python
banned_competencies: list[str]   # topics Interviewer must skip
question_budget: dict[str, int]  # remaining questions per competency (auto-bans at 0)
coach_directives: list[str]      # explicit instructions consumed by next Interviewer call
```

### Personalized Candidate Context

Before the first question, Friday builds a candidate profile from up to four sources concurrently:

| Source | Tool | What it does |
|--------|------|-------------|
| **GitHub username** | `tools/github.py` | Fetches all repos, LLM-summarizes each, creates a condensed engineering profile |
| **Google Scholar name** | `tools/scholar.py` | Pulls publications via `scholarly`, summarizes research background |
| **Resume file** | `tools/resume.py` | Extracts text from PDF (`pypdf`) or plain text, LLM-summarizes |
| **Job posting URL** | `tools/job_scraper.py` | Fetches page with `httpx`, strips HTML with BeautifulSoup, extracts role requirements |

All context is injected into the Interviewer's system prompt so questions are anchored to the candidate's actual background.

### Multi-Provider LLM Support

```python
# backend/llm/manager.py
# Default: Anthropic Claude. Swap via LLM_PROVIDER env var.
# Supported: anthropic | openai | google | ollama
```

All providers use the same `complete()` and `complete_with_tools()` interface. Tool-use loops (call → execute → feed results → repeat) are native on Anthropic; other providers fall back to plain completion.

### RAG Gap Detection

Every answer is embedded (OpenAI `text-embedding-3-small`) and stored in Supabase pgvector. Before generating a follow-up, the Followup agent runs a semantic similarity search over the session's prior Q&A to detect recurring weak areas and prevent easy topics from dominating.

### Developer Debugging — `agent_trace`

Every `/turn` response includes a per-turn decision log:

```json
"agent_trace": [
  { "node": "grader",      "decision": "score=3, competency=problem_solving" },
  { "node": "router",      "decision": "score=3 → routing to followup" },
  { "node": "followup",    "decision": "RAG gap detected on 'problem_solving', triggering targeted question" },
  { "node": "router",      "decision": "followup → interviewer" },
  { "node": "interviewer", "decision": "serving follow-up question immediately" }
]
```

### Voice-First Interaction

- **TTS**: Questions are synthesized via ElevenLabs (`eleven_turbo_v2`) and returned as base64 MP3 per response
- **STT**: Answers transcribed in real time via the browser Web Speech API with text-input fallback
- **Interrupt**: `POST /tts/interrupt` cancels active playback mid-sentence

### Difficulty Calibration

- 5-level scale: Entry → Junior → Mid-Level → Senior → Staff/Principal
- Auto-adjusts up when rolling average score ≥ 4.0, down when ≤ 2.0
- Per-competency budget prevents over-testing any single topic

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                          │
│                                                                        │
│   Landing Page    Interview Setup    Active Session    Report          │
│                   GitHub / Scholar   Voice + Chat     Scores/Notes    │
│                   Resume / Job URL                                     │
│                                                                        │
│   Web Speech API (STT)    ElevenLabs TTS Player    Vercel Analytics   │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ HTTP / REST (multipart + JSON)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Backend (FastAPI)                             │
│                                                                        │
│  POST /sessions          POST /sessions/{id}/start                   │
│  POST /sessions/{id}/turn  GET /sessions/{id}/report                 │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                  LangGraph Agent Pipeline                      │    │
│  │                                                                │    │
│  │  Interviewer ──▶ Grader ──▶ [Clarifier | Followup] ──▶ Coach │    │
│  │      ▲_______________________________________________│         │    │
│  │                                                                │    │
│  │              Shared InterviewState (in-memory)                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  tools/github.py   tools/scholar.py   tools/resume.py                │
│  tools/job_scraper.py   tools/agent_tools.py (question bank)         │
│  rag/retriever.py (pgvector)   llm/manager.py (multi-provider)       │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL + pgvector)                     │
│                                                                        │
│   sessions   messages   message_embeddings   competency_scores        │
│   RLS policies — users access only their own sessions                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 App Router, Tailwind CSS v4, TypeScript |
| **Backend** | FastAPI, Python 3.11+, uvicorn |
| **Agent Orchestration** | LangGraph (stateful multi-agent with conditional edges) |
| **LLM** | Anthropic Claude (default) — OpenAI, Google Gemini, Ollama supported |
| **TTS** | ElevenLabs `eleven_turbo_v2` |
| **STT** | Web Speech API (browser-native) |
| **RAG Embeddings** | OpenAI `text-embedding-3-small` |
| **Vector Store** | Supabase pgvector |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (bypassable via `AUTH_ENABLED` flag) |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | GCP Cloud Run |

---

## Project Structure

```
Friday/
├── dev.sh / kill.sh / setup.sh / deploy.sh
│
├── backend/
│   ├── main.py                  FastAPI app entry point
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   ├── agents/
│   │   ├── state.py             InterviewState TypedDict
│   │   ├── graph.py             LangGraph graph + routing functions
│   │   ├── interviewer.py       Question selection with tool use
│   │   ├── grader.py            Answer scoring (1–5, competency, gaps)
│   │   ├── clarifier.py         Probing questions for score ≤ 2
│   │   ├── followup.py          RAG-driven targeted follow-ups
│   │   └── coach.py             State mutation + coaching notes
│   │
│   ├── tools/
│   │   ├── agent_tools.py       Question bank (135 Q) + tool schemas + executors
│   │   ├── tts.py               ElevenLabs synthesis + interrupt
│   │   ├── github.py            GitHub repo fetch + LLM summarization
│   │   ├── scholar.py           Google Scholar publication lookup
│   │   ├── resume.py            PDF/text resume extraction
│   │   └── job_scraper.py       Job posting URL scraper
│   │
│   ├── llm/
│   │   └── manager.py           Multi-provider LLM (Anthropic/OpenAI/Google/Ollama)
│   │
│   ├── rag/
│   │   ├── embeddings.py        OpenAI text-embedding-3-small
│   │   └── retriever.py         pgvector similarity search
│   │
│   ├── db/
│   │   ├── client.py            Supabase client singleton
│   │   ├── queries.py           All DB helpers
│   │   └── schema.sql           Run once in Supabase SQL editor
│   │
│   └── api/
│       ├── sessions.py          Session + turn endpoints
│       └── tts.py               TTS endpoints
│
└── frontend/
    ├── app/
    │   ├── layout.tsx            Root layout + SEO metadata + JSON-LD
    │   ├── page.tsx              Landing page
    │   ├── globals.css           Design system (glassmorphism tokens)
    │   ├── robots.ts             robots.txt generation
    │   ├── sitemap.ts            sitemap.xml generation
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── interview/
    │   │   ├── setup/page.tsx    Interview configuration + context upload
    │   │   └── [sessionId]/page.tsx  Active session (voice + chat)
    │   └── report/
    │       └── [sessionId]/page.tsx  Post-session coaching report
    │
    ├── components/
    │   ├── landing/              Hero, Features, HowItWorks, CTA
    │   ├── layout/               Navbar, Footer
    │   └── interview/            AudioRecorder, TTSPlayer, TranscriptPanel
    │
    └── lib/
        ├── auth-config.ts        AUTH_ENABLED single source of truth
        ├── api.ts                Backend API client (FormData + JSON)
        ├── supabase.ts           Supabase browser client
        └── supabase-server.ts    Supabase server client
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |

### Quick Setup

```bash
git clone https://github.com/yourusername/friday.git
cd friday
bash setup.sh
```

The setup script installs backend dependencies into `.venv`, installs frontend npm packages, and walks you through creating `.env` files.

### Running Locally

```bash
bash dev.sh
```

- **Frontend** → http://localhost:3000
- **Backend** → http://localhost:8000
- **API Docs** → http://localhost:8000/docs

```bash
bash kill.sh   # stop both processes
```

### Auth Bypass (Development)

Set `AUTH_ENABLED = false` in `frontend/lib/auth-config.ts` to bypass Supabase Auth entirely. The app routes directly to `/interview/setup` and never checks session tokens.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs TTS key |
| `OPENAI_API_KEY` | ✅ | For RAG embeddings (`text-embedding-3-small`) |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (server-only) |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `LLM_PROVIDER` | ❌ | `anthropic` (default) \| `openai` \| `google` \| `ollama` |
| `MAX_TURNS` | ❌ | Interview length (default: `8`) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Same Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL (`http://localhost:8000` or Cloud Run URL) |
| `NEXT_PUBLIC_SITE_URL` | ❌ | Canonical site URL for SEO (e.g. `https://interviewwithfriday.com`) |

---

## API Reference

All endpoints require the `X-User-Id` header (sent automatically by the frontend).

### Sessions

```
POST   /sessions                    Create session (multipart/form-data)
POST   /sessions/{id}/start         Get first question
POST   /sessions/{id}/turn          Submit answer → full agent pipeline
GET    /sessions/{id}/report        Coaching report (scores, notes, transcript)
GET    /sessions/{id}/history       Raw message history
```

**`POST /sessions`** — multipart form fields:

| Field | Type | Description |
|-------|------|-------------|
| `interview_type` | string | `behavioral` |
| `difficulty` | int | 1–5 |
| `role` | string | Target job title |
| `github_username` | string | Optional — GitHub profile context |
| `scholar_name` | string | Optional — Google Scholar context |
| `job_url` | string | Optional — job posting URL |
| `resume` | file | Optional — PDF or text |

**`POST /sessions/{id}/turn`** response:

```json
{
  "session_complete": false,
  "grading": {
    "score": 3,
    "competency": "problem_solving",
    "feedback": "...",
    "strengths": ["..."],
    "gaps": ["..."]
  },
  "coaching_note": "Next time, quantify the business impact.",
  "question": "Tell me about a time you had to make a decision with incomplete information.",
  "tts_audio": "<base64 MP3>",
  "turn": 3,
  "difficulty": 3,
  "is_followup": false,
  "route": "followup",
  "human_review_flag": null,
  "agent_trace": [
    { "node": "grader",      "decision": "score=3, competency=problem_solving" },
    { "node": "router",      "decision": "score=3 → routing to followup" },
    { "node": "followup",    "decision": "no follow-up gaps found, proceeding to coach" },
    { "node": "coach",       "decision": "rolling avg 3.2, difficulty held at 3, session_complete=False" },
    { "node": "interviewer", "decision": "selecting next question at difficulty 3" }
  ]
}
```

---

## Database Schema

Run `backend/db/schema.sql` in the Supabase SQL editor before first launch.

```sql
sessions             -- Interview sessions (type, role, difficulty, status, timestamps)
messages             -- All Q&A turns (role, content, score, competency, is_followup)
message_embeddings   -- pgvector 1536-dim embeddings for RAG gap detection
competency_scores    -- Rolling per-competency scores within a session
```

Row Level Security is enabled on all tables.

---

## Deployment

### One-command deploy

```bash
bash deploy.sh
```

Handles Docker build + push to Google Artifact Registry, `gcloud run deploy`, and `vercel --prod` in sequence.

### Manual: Backend → GCP Cloud Run

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/friday-backend ./backend

gcloud run deploy friday-backend \
  --image gcr.io/YOUR_PROJECT/friday-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "ANTHROPIC_API_KEY=...,SUPABASE_URL=..."
```

### Manual: Frontend → Vercel

```bash
cd frontend && vercel --prod
```

Set `NEXT_PUBLIC_API_URL` to your Cloud Run service URL in the Vercel project settings.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built by [Variant Labs](https://www.vriantlabs.com) · [hello@vriantlabs.com](mailto:hello@vriantlabs.com)

</div>
