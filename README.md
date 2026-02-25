<div align="center">

# Friday — AI Mock Interview Coach

**The open-source AI-powered interview coach that adapts to you.**

[![GitHub Stars](https://img.shields.io/github/stars/yourusername/friday?style=social)](https://github.com/yourusername/friday)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-orange)](https://anthropic.com)
[![LangGraph](https://img.shields.io/badge/Multi--Agent-LangGraph-green)](https://langchain-ai.github.io/langgraph/)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)

Practice behavioral interviews, technical interviews, and role-based interviews with an AI coach that listens, adapts, and never lets you off easy.

[Get Started](#getting-started) · [Features](#features) · [Architecture](#architecture) · [Deploy](#deployment) · [Contributing](#contributing)

</div>

---

## What is Friday?

**Friday** is a full-stack, open-source **AI mock interview simulator** built with a stateful multi-agent loop (LangGraph + Claude), a RAG pipeline for detecting knowledge gaps, and a voice-first interface (TTS + STT). It's the closest thing to a real interview — without the nerves of having a human judge you.

Whether you're preparing for a **FAANG technical interview**, a **behavioral interview at a startup**, or a **senior engineering role**, Friday adapts to your skill level in real time and tells you exactly where you're falling short.

> Built with: **Anthropic Claude** · **LangGraph** · **FastAPI** · **Next.js 15** · **Supabase** · **ElevenLabs TTS** · **Vercel** · **GCP Cloud Run**

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Setup](#quick-setup)
  - [Running Locally](#running-locally)
- [Scripts Reference](#scripts-reference)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Adaptive Multi-Agent Interview Loop

Friday runs a **stateful LangGraph pipeline** with four specialized AI agents that share session memory and collaborate to run a coherent, calibrated interview:

| Agent | Role |
|-------|------|
| **Interviewer** | Generates calibrated questions using Claude Opus. Adjusts complexity dynamically based on your performance history. |
| **Grader** | Evaluates every answer with Claude Sonnet. Outputs a structured score (1–5), identified competency, strengths, and specific gaps. |
| **Follow-up** | Queries a RAG vector store of your prior responses to detect recurring weaknesses. Triggers targeted follow-up questions when gaps are found. |
| **Coach** | Produces per-turn coaching insights with Claude Haiku. Adjusts the session difficulty up or down based on rolling competency scores. |

### RAG-Powered Gap Detection

Every answer you give is embedded (OpenAI `text-embedding-3-small`) and stored in **Supabase pgvector**. Before generating each follow-up, the Follow-up agent performs a **semantic similarity search** over your prior Q&A history to:

- Detect recurring topics you've struggled with
- Surface questions that target your weakest competencies
- Prevent easy topics from dominating the session

### Voice-First Interaction

- **TTS**: Questions are spoken aloud using ElevenLabs (`eleven_turbo_v2`) — architected as a callable Anthropic tool with a clean provider interface (ready to swap when Anthropic ships native TTS).
- **Interrupt handling**: Stop TTS mid-sentence — per-session interrupt flags propagate from frontend button to backend `POST /tts/interrupt`.
- **STT**: Answers are transcribed in real time using the browser's Web Speech API. Graceful fallback to text input.

### Calibrated Difficulty Progression

- 5-level difficulty scale: Entry → Junior → Mid-Level → Senior → Staff/Principal
- Auto-adjusts upward when your rolling score exceeds 4.0, downward below 2.0
- Visual difficulty meter with per-competency score tracking

### Interview Modes

- **Behavioral** — STAR-format questions about leadership, conflict resolution, impact, and growth
- **Technical** — Algorithms, data structures, system design, debugging, and engineering fundamentals
- **Role-Based** — Custom questions anchored to a target role + job description you provide

### Full Coaching Report

After every session you get:
- Overall performance score (1–5)
- Per-competency breakdown with rolling averages
- Turn-by-turn coaching notes
- Full searchable transcript with scores and competency tags

---

## Demo

> _Screenshots / GIF coming soon. Star the repo to get notified when the hosted demo launches._

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (Next.js 15)                       │
│                                                                       │
│  Landing Page   Interview Setup   Active Session      Report         │
│  (SEO/GEO opt)  (type/role/diff)  (voice + chat)   (scores/notes)  │
│                                                                       │
│  AudioRecorder (Web Speech API)   TTSPlayer (ElevenLabs base64)     │
│  TranscriptPanel (live Q&A log)   DifficultyMeter (competency viz)  │
│                                                                       │
│  Supabase Auth (email/password)   Vercel Analytics                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP / REST
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Backend (FastAPI)                             │
│                                                                       │
│  POST /sessions          POST /sessions/{id}/start                  │
│  POST /sessions/{id}/turn  GET /sessions/{id}/report                │
│  POST /tts               POST /tts/interrupt                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   LangGraph Agent Loop                       │    │
│  │                                                               │    │
│  │  ┌────────────┐    ┌──────────┐    ┌───────────┐            │    │
│  │  │ Interviewer│───▶│  Grader  │───▶│ Follow-up │            │    │
│  │  │ (Opus 4.6) │    │(Sonnet   │    │ (RAG +    │            │    │
│  │  │            │◀───│  4.6)    │    │  Haiku)   │            │    │
│  │  └────────────┘    └──────────┘    └─────┬─────┘            │    │
│  │        ▲                                  │                   │    │
│  │        │           ┌──────────┐           │                   │    │
│  │        └───────────│  Coach   │◀──────────┘                   │    │
│  │                    │ (Haiku)  │                               │    │
│  │                    └──────────┘                               │    │
│  │                                                               │    │
│  │            Shared InterviewState (in-memory)                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │  TTS Tool       │  │  RAG Pipeline   │  │  DB Queries      │   │
│  │  ElevenLabs +   │  │  OpenAI embeds  │  │  Supabase        │   │
│  │  interrupt flag │  │  pgvector sim   │  │  service role    │   │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Supabase (PostgreSQL + pgvector)               │
│                                                                       │
│   sessions    messages    message_embeddings    competency_scores    │
│                                                                       │
│   RLS policies on all tables (user can only access own sessions)     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15 (App Router) | React framework, SSR, routing |
| **UI** | ShadCN UI + TailwindCSS | Component library + utility-first styling |
| **Analytics** | Vercel Analytics | Page view and event tracking |
| **Backend** | FastAPI | High-performance async Python API |
| **Agent Orchestration** | LangGraph | Stateful multi-agent loop with conditional edges |
| **LLM** | Anthropic Claude (Opus 4.6, Sonnet 4.6, Haiku 4.5) | Interview generation, grading, coaching |
| **TTS** | ElevenLabs (`eleven_turbo_v2`) | Text-to-speech synthesis |
| **STT** | Web Speech API (browser-native) | Real-time speech recognition |
| **RAG Embeddings** | OpenAI `text-embedding-3-small` | Semantic embedding of Q&A pairs |
| **Vector Store** | Supabase pgvector | Similarity search for gap detection |
| **Database** | Supabase (PostgreSQL) | Sessions, messages, competency scores |
| **Auth** | Supabase Auth | Email/password authentication |
| **Frontend Hosting** | Vercel | CDN, edge functions, CI/CD |
| **Backend Hosting** | GCP Cloud Run | Containerized serverless deployment |

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Bundled with Node |
| Google Cloud SDK | Latest | [cloud.google.com/sdk](https://cloud.google.com/sdk) |
| Vercel CLI | Latest | `npm i -g vercel` |

### Quick Setup

The fastest way to get up and running — one script handles everything:

```bash
git clone https://github.com/yourusername/friday.git
cd friday
bash scripts/setup.sh
```

This script will:
1. Check all required tools are installed
2. Create Python virtual environment and install backend dependencies
3. Install frontend Node.js dependencies
4. Walk you through creating `.env` files for both services
5. Print the Supabase SQL you need to run in your project dashboard

### Running Locally

After setup, start both frontend and backend with a single command:

```bash
bash scripts/dev.sh
```

- **Backend** → [http://localhost:8000](http://localhost:8000)
- **Frontend** → [http://localhost:3000](http://localhost:3000)
- **API Docs** → [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)

To stop all processes:

```bash
bash scripts/kill.sh
```

---

## Scripts Reference

| Script | What it does |
|--------|-------------|
| `bash scripts/setup.sh` | **First-time setup.** Installs all dependencies (Python venv + npm), guides you through filling in API keys, creates `.env` files. |
| `bash scripts/dev.sh` | **Local development.** Starts backend (FastAPI/uvicorn) and frontend (Next.js) together with unified log output. Ctrl+C stops both. |
| `bash scripts/kill.sh` | **Process cleanup.** Kills any running uvicorn (port 8000) and Next.js (port 3000) processes. |
| `bash scripts/deploy.sh` | **Production deployment.** Deploys backend to GCP Cloud Run and frontend to Vercel in sequence. Handles Docker build, push, and `gcloud run deploy`. |

---

## API Reference

All endpoints require the `X-User-Id` header (set automatically by the frontend from Supabase Auth session).

### Sessions

```
POST   /sessions                    Create a new interview session
POST   /sessions/{id}/start         Get first question (runs Interviewer node)
POST   /sessions/{id}/turn          Submit answer → grade → follow-up → coach → next question
GET    /sessions/{id}/report        Full coaching report (scores, notes, transcript)
GET    /sessions/{id}/history       Raw message history
```

**`POST /sessions`** body:
```json
{
  "interview_type": "behavioral | technical | general",
  "role": "Senior Software Engineer (optional)",
  "difficulty": 3
}
```

**`POST /sessions/{id}/turn`** body:
```json
{ "answer": "In my previous role at..." }
```

**`POST /sessions/{id}/turn`** response:
```json
{
  "session_complete": false,
  "grading": {
    "score": 4,
    "competency": "problem-solving",
    "feedback": "Strong use of the STAR method...",
    "strengths": ["clear structure", "quantified impact"],
    "gaps": ["missing stakeholder context"]
  },
  "coaching_note": "Next time, mention who was affected by the outcome.",
  "question": "Tell me about a time you had to make a decision with incomplete information.",
  "tts_audio": "<base64-encoded MP3>",
  "turn": 3,
  "difficulty": 4,
  "is_followup": false
}
```

### TTS

```
POST   /tts                         Synthesize text to base64 MP3 audio
POST   /tts/interrupt               Cancel active TTS playback for a session
```

---

## Database Schema

Run `backend/db/schema.sql` in your Supabase project's SQL editor before first launch.

```sql
sessions             -- Interview sessions (type, role, difficulty, status)
messages             -- All Q&A turns (role, content, score, competency, is_followup)
message_embeddings   -- pgvector embeddings for RAG gap detection (vector(1536))
competency_scores    -- Rolling per-competency scores across a session
```

Row Level Security is enabled on all tables — users can only access their own sessions.

---

## Deployment

### One-Command Deploy

```bash
bash scripts/deploy.sh
```

This script handles:
1. Docker build + push to Google Artifact Registry
2. `gcloud run deploy` with production environment variables
3. `vercel --prod` for the frontend

### Manual: Backend → GCP Cloud Run

```bash
cd backend

# Build and push Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT/friday-backend

# Deploy to Cloud Run
gcloud run deploy friday-backend \
  --image gcr.io/YOUR_PROJECT/friday-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars ANTHROPIC_API_KEY=...,SUPABASE_URL=...,...
```

### Manual: Frontend → Vercel

```bash
cd frontend
vercel --prod
```

Set these environment variables in the Vercel project dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (your Cloud Run URL)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key — [console.anthropic.com](https://console.anthropic.com) |
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs TTS key — [elevenlabs.io](https://elevenlabs.io) |
| `OPENAI_API_KEY` | ✅ | For `text-embedding-3-small` (RAG) — [platform.openai.com](https://platform.openai.com) |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (never expose publicly) |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `MAX_TURNS` | ❌ | Interview length (default: `8`) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Same Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key (safe to expose) |
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL (e.g. `http://localhost:8000` or Cloud Run URL) |

---

## Project Structure

```
Friday/
├── scripts/
│   ├── setup.sh          First-time install + .env configuration
│   ├── dev.sh            Start both services locally
│   ├── kill.sh           Kill running frontend/backend processes
│   └── deploy.sh         Deploy to Vercel + GCP Cloud Run
│
├── backend/
│   ├── main.py           FastAPI app + CORS
│   ├── run.sh            Backend-only dev runner
│   ├── Dockerfile        GCP Cloud Run container
│   ├── requirements.txt
│   ├── agents/
│   │   ├── state.py      InterviewState TypedDict
│   │   ├── graph.py      LangGraph graph definition
│   │   ├── interviewer.py
│   │   ├── grader.py
│   │   ├── followup.py
│   │   └── coach.py
│   ├── tools/
│   │   └── tts.py        ElevenLabs TTS tool + interrupt
│   ├── rag/
│   │   ├── embeddings.py OpenAI embeddings
│   │   └── retriever.py  pgvector similarity search
│   ├── db/
│   │   ├── client.py     Supabase client singleton
│   │   ├── queries.py    All DB helpers
│   │   └── schema.sql    Run once in Supabase SQL editor
│   └── api/
│       ├── sessions.py   Session + turn endpoints
│       └── tts.py        TTS endpoints
│
└── frontend/
    ├── app/
    │   ├── page.tsx          Landing page (SEO optimized)
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── interview/
    │   │   ├── setup/page.tsx
    │   │   └── [sessionId]/page.tsx
    │   └── report/
    │       └── [sessionId]/page.tsx
    ├── components/
    │   ├── interview/
    │   │   ├── AudioRecorder.tsx   Web Speech API STT
    │   │   ├── TTSPlayer.tsx       Audio playback + interrupt
    │   │   ├── QuestionCard.tsx
    │   │   ├── TranscriptPanel.tsx
    │   │   └── DifficultyMeter.tsx
    │   ├── landing/
    │   │   ├── Hero.tsx
    │   │   ├── Features.tsx
    │   │   ├── HowItWorks.tsx
    │   │   └── CTA.tsx
    │   └── layout/
    │       ├── Navbar.tsx
    │       └── Footer.tsx
    ├── lib/
    │   ├── supabase.ts
    │   ├── supabase-server.ts
    │   └── api.ts
    └── types/
        └── index.ts
```

---

## Contributing

Contributions are welcome. Here's how to get started:

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Run `bash scripts/setup.sh` to configure your local environment
3. Make your changes and test with `bash scripts/dev.sh`
4. Open a pull request with a clear description of the change

### Ideas for contribution

- [ ] Supabase Realtime session sync (multi-tab support)
- [ ] Whisper API fallback for STT (higher accuracy)
- [ ] Session history dashboard (past interviews, trend charts)
- [ ] Custom question bank uploads (PDF/JD ingestion)
- [ ] Coding challenge mode (Monaco editor integration)
- [ ] Vercel AI SDK streaming responses
- [ ] Mobile-responsive voice recorder improvements
- [ ] Redis-backed session state (replace in-memory dict for multi-instance deployments)

---

## Keywords

> _AI interview coach · AI mock interview · interview preparation AI · LangGraph multi-agent · behavioral interview practice · technical interview prep · STAR format interview · voice interview simulator · adaptive interview questions · AI interview feedback · Claude AI interview · interview coaching tool · software engineer interview practice · system design interview prep · job interview simulator · open source interview coach_

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with Claude · LangGraph · FastAPI · Next.js

If Friday helped you land a job, please ⭐ the repo — it helps others find it too.

</div>
