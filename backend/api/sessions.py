from __future__ import annotations
import asyncio
import os

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from pydantic import BaseModel

from agents.state import InterviewState
from agents.interviewer import interviewer_node
from agents.orchestrator import run_turn
from db.queries import (
    create_session,
    get_session,
    complete_session,
    save_message,
    update_message_score,
    get_messages,
    get_competency_scores,
)
from rag.retriever import index_answer
from tools.agent_tools import ALL_COMPETENCIES, DEFAULT_QUESTION_BUDGET
from tools.github import build_candidate_context
from tools.resume import parse_resume
from tools.job_scraper import fetch_job_description
from tools.scholar import build_scholar_context
from tools.tts import generate_tts

router = APIRouter()
MAX_TURNS = int(os.getenv("MAX_TURNS", "8"))

# In-process session state store. Sessions that haven't been completed yet live here.
_session_states: dict[str, InterviewState] = {}


class TurnRequest(BaseModel):
    answer: str


# ── Session creation ──────────────────────────────────────────────────────────

@router.post("")
async def create_interview_session(
    interview_type: str = Form(...),
    difficulty: int = Form(3),
    role: str | None = Form(None),
    github_username: str | None = Form(None),
    scholar_name: str | None = Form(None),
    job_url: str | None = Form(None),
    resume: UploadFile | None = File(None),
    x_user_id: str = Header(..., alias="X-User-Id"),
):
    if interview_type not in ("behavioral", "technical", "general"):
        raise HTTPException(status_code=400, detail="Invalid interview_type")
    if not (1 <= difficulty <= 5):
        raise HTTPException(status_code=400, detail="Difficulty must be 1-5")

    session = create_session(user_id=x_user_id, interview_type=interview_type, role=role)
    session_id = session["id"]

    # Fetch all candidate context sources concurrently
    candidate_context = await _build_candidate_context(
        github_username=github_username,
        scholar_name=scholar_name,
        resume=resume,
        job_url=job_url,
    )

    state: InterviewState = {
        "session_id": session_id,
        "user_id": x_user_id,
        "interview_type": interview_type,
        "role": role or "Software Engineer",
        "difficulty": difficulty,
        "turn_count": 0,
        "max_turns": MAX_TURNS,
        "messages": [],
        "competency_scores": {},
        "current_question": "",
        "current_answer": "",
        "grading": {},
        "follow_up_needed": False,
        "follow_up_question": "",
        "clarifier_active": False,
        "session_complete": False,
        "coaching_notes": [],
        "tts_audio": None,
        "candidate_context": candidate_context,
        "human_review_flag": None,
        "banned_competencies": [],
        "question_budget": {c: DEFAULT_QUESTION_BUDGET for c in ALL_COMPETENCIES},
        "coach_directives": [],
        "agent_trace": [],
    }
    _session_states[session_id] = state

    return {"session_id": session_id}


# ── Start session ─────────────────────────────────────────────────────────────

@router.post("/{session_id}/start")
async def start_session(session_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
    """Run the interviewer once to get the opening question."""
    session = _get_authorized_session(session_id, x_user_id)
    state = _get_state(session_id)

    state.update(await interviewer_node(state))
    question = state["current_question"]

    turn = state["turn_count"] + 1
    msg = save_message(session_id=session_id, role="interviewer", content=question, turn_number=turn)
    state["messages"].append({"role": "interviewer", "content": question, "turn_number": turn, "id": msg["id"]})

    tts_audio = await generate_tts(question, session_id)

    return {
        "question": question,
        "tts_audio": tts_audio,
        "turn": turn,
        "difficulty": state["difficulty"],
        "session_complete": False,
    }


# ── Submit turn ───────────────────────────────────────────────────────────────

@router.post("/{session_id}/turn")
async def submit_turn(
    session_id: str,
    body: TurnRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
):
    session = _get_authorized_session(session_id, x_user_id)
    state = _get_state(session_id)

    if state["session_complete"]:
        raise HTTPException(status_code=400, detail="Session already completed")

    # Advance turn counter and persist the user answer
    state["current_answer"] = body.answer
    current_turn = state["turn_count"] + 1
    state["turn_count"] = current_turn

    user_msg = save_message(
        session_id=session_id,
        role="user",
        content=body.answer,
        turn_number=current_turn,
    )
    state["messages"].append({
        "role": "user",
        "content": body.answer,
        "turn_number": current_turn,
        "id": user_msg["id"],
    })

    # Run the agent pipeline (grader → router → [clarifier|followup|coach] → interviewer)
    result = await run_turn(state)

    # Back-fill score and index for RAG (non-critical)
    grading = result.grading
    competency = grading.get("competency", "general")
    score = grading.get("score", 3)
    update_message_score(user_msg["id"], competency, score)

    try:
        await index_answer(
            session_id=session_id,
            message_id=user_msg["id"],
            question=state["current_question"],
            answer=body.answer,
            competency=competency,
            score=score,
        )
    except Exception:
        pass

    # Immediate follow-up: coach was skipped, serve the follow-up question now
    if result.immediate_followup and result.question:
        next_turn = current_turn + 1
        next_msg = save_message(
            session_id=session_id,
            role="interviewer",
            content=result.question,
            turn_number=next_turn,
            is_followup=True,
        )
        state["messages"].append({
            "role": "interviewer",
            "content": result.question,
            "turn_number": next_turn,
            "is_followup": True,
            "id": next_msg["id"],
        })
        tts_audio = await generate_tts(result.question, session_id)
        return {
            "session_complete": False,
            "grading": grading,
            "coaching_note": "",
            "question": result.question,
            "tts_audio": tts_audio,
            "turn": next_turn,
            "difficulty": result.difficulty,
            "is_followup": True,
            "route": "followup",
            "agent_trace": result.trace,
        }

    # Session complete
    if result.session_complete:
        complete_session(session_id, result.difficulty)
        _save_final_coaching_summary(state, session_id)
        return {
            "session_complete": True,
            "grading": grading,
            "coaching_note": result.coaching_note,
            "question": None,
            "tts_audio": None,
            "turn": current_turn,
            "difficulty": result.difficulty,
            "route": result.route,
            "agent_trace": result.trace,
        }

    # Normal next question
    next_turn = current_turn + 1
    next_msg = save_message(
        session_id=session_id,
        role="interviewer",
        content=result.question,
        turn_number=next_turn,
        is_followup=result.is_followup,
    )
    state["messages"].append({
        "role": "interviewer",
        "content": result.question,
        "turn_number": next_turn,
        "is_followup": result.is_followup,
        "id": next_msg["id"],
    })
    tts_audio = await generate_tts(result.question, session_id)

    return {
        "session_complete": False,
        "grading": grading,
        "coaching_note": result.coaching_note,
        "question": result.question,
        "tts_audio": tts_audio,
        "turn": next_turn,
        "difficulty": result.difficulty,
        "is_followup": result.is_followup,
        "route": result.route,
        "human_review_flag": state.get("human_review_flag"),
        "agent_trace": result.trace,
    }


# ── Report & history ──────────────────────────────────────────────────────────

@router.get("/{session_id}/report")
async def get_report(session_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
    _get_authorized_session(session_id, x_user_id)

    messages = get_messages(session_id)
    competency_scores = get_competency_scores(session_id)
    coaching_notes = _session_states.get(session_id, {}).get("coaching_notes", [])

    scored = [m for m in messages if m.get("score") is not None]
    overall_score = sum(m["score"] for m in scored) / len(scored) if scored else 0

    return {
        "session": get_session(session_id),
        "overall_score": round(overall_score, 2),
        "competency_scores": competency_scores,
        "coaching_notes": coaching_notes,
        "messages": messages,
        "total_turns": len([m for m in messages if m["role"] == "user"]),
    }


@router.get("/{session_id}/history")
async def get_history(session_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
    _get_authorized_session(session_id, x_user_id)
    return {"messages": get_messages(session_id)}


# ── Private helpers ───────────────────────────────────────────────────────────

def _get_authorized_session(session_id: str, user_id: str) -> dict:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return session


def _get_state(session_id: str) -> InterviewState:
    state = _session_states.get(session_id)
    if not state:
        raise HTTPException(status_code=400, detail="Session state not initialized. Create session first.")
    return state


async def _build_candidate_context(
    github_username: str | None,
    scholar_name: str | None,
    resume: UploadFile | None,
    job_url: str | None,
) -> str:
    tasks = []
    if github_username:
        tasks.append(build_candidate_context(github_username))
    if scholar_name:
        tasks.append(build_scholar_context(scholar_name))
    if resume and resume.filename:
        file_bytes = await resume.read()
        tasks.append(parse_resume(file_bytes, resume.content_type or "text/plain"))
    if job_url:
        tasks.append(fetch_job_description(job_url))

    if not tasks:
        return ""

    results = await asyncio.gather(*tasks, return_exceptions=True)
    parts = [r for r in results if isinstance(r, str) and r.strip()]
    return "\n\n---\n\n".join(parts)


def _save_final_coaching_summary(state: InterviewState, session_id: str) -> None:
    if not state.get("coaching_notes"):
        return
    summary = "\n".join(f"• {note}" for note in state["coaching_notes"])
    save_message(
        session_id=session_id,
        role="coach",
        content=summary,
        turn_number=state["turn_count"] + 1,
    )
