from __future__ import annotations
from typing import TypedDict


class InterviewState(TypedDict):
    session_id: str
    user_id: str
    interview_type: str          # behavioral | technical | general
    role: str                    # target job role
    difficulty: int              # 1–5, dynamically calibrated
    turn_count: int
    max_turns: int
    messages: list[dict]
    competency_scores: dict      # {competency: rolling_score}
    current_question: str
    current_answer: str
    grading: dict                # {score, competency, feedback, strengths, gaps}
    follow_up_needed: bool
    follow_up_question: str
    clarifier_active: bool       # True when a clarifier (score 1–2) fired this turn
    session_complete: bool
    coaching_notes: list[str]
    tts_audio: str | None
    candidate_context: str       # GitHub + Scholar + resume + job description
    human_review_flag: dict | None  # Set by Coach via flag_for_human_review tool
    # ── Coach-driven session management ──────────────────────────────────────
    banned_competencies: list[str]   # topics Coach marked as saturated; Interviewer skips these
    question_budget: dict[str, int]  # remaining Qs per competency; auto-bans at 0
    coach_directives: list[str]      # explicit instructions Interviewer must follow next turn
    agent_trace: list[dict]          # per-turn decision log for developer debugging
