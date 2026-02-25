from __future__ import annotations
from typing import TypedDict


class InterviewState(TypedDict):
    session_id: str
    user_id: str
    interview_type: str          # behavioral | technical | general
    role: str                    # target job role
    difficulty: int              # 1-5, dynamically calibrated
    turn_count: int
    max_turns: int               # configurable session length
    messages: list[dict]         # full conversation history
    competency_scores: dict      # {competency: rolling_score}
    current_question: str
    current_answer: str
    grading: dict                # {score, competency, feedback, strengths, gaps}
    follow_up_needed: bool
    follow_up_question: str
    session_complete: bool
    coaching_notes: list[str]
    tts_audio: str | None        # base64-encoded audio for current question
