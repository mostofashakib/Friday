from __future__ import annotations
import os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import anthropic
from agents.state import InterviewState
from agents.interviewer import interviewer_node
from agents.grader import grader_node
from agents.followup import followup_node
from agents.coach import coach_node
from db.queries import (
    create_session,
    get_session,
    update_session,
    complete_session,
    save_message,
    get_messages,
    get_competency_scores,
)
from rag.retriever import index_answer

router = APIRouter()
MAX_TURNS = int(os.getenv("MAX_TURNS", "8"))

# In-memory session state cache (replace with Redis for multi-instance production)
_session_states: dict[str, InterviewState] = {}


class CreateSessionRequest(BaseModel):
    interview_type: str  # behavioral | technical | general
    role: str | None = None
    difficulty: int = 3


class TurnRequest(BaseModel):
    answer: str


def _get_user_id(authorization: str | None) -> str:
    """Extract user ID from Supabase JWT. Simplified for now."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")
    # In production: decode and verify JWT with Supabase JWT secret
    # For now we pass user_id as a claim extracted by Supabase middleware
    return authorization.replace("Bearer ", "").strip()


@router.post("")
async def create_interview_session(
    body: CreateSessionRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
):
    """Create a new interview session."""
    if body.interview_type not in ("behavioral", "technical", "general"):
        raise HTTPException(status_code=400, detail="Invalid interview_type")
    if not (1 <= body.difficulty <= 5):
        raise HTTPException(status_code=400, detail="Difficulty must be 1-5")

    session = create_session(
        user_id=x_user_id,
        interview_type=body.interview_type,
        role=body.role,
    )
    session_id = session["id"]

    state: InterviewState = {
        "session_id": session_id,
        "user_id": x_user_id,
        "interview_type": body.interview_type,
        "role": body.role or "Software Engineer",
        "difficulty": body.difficulty,
        "turn_count": 0,
        "max_turns": MAX_TURNS,
        "messages": [],
        "competency_scores": {},
        "current_question": "",
        "current_answer": "",
        "grading": {},
        "follow_up_needed": False,
        "follow_up_question": "",
        "session_complete": False,
        "coaching_notes": [],
        "tts_audio": None,
    }
    _session_states[session_id] = state

    return {"session_id": session_id}


@router.post("/{session_id}/start")
async def start_session(session_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
    """Run the interviewer node to get the first question."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != x_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    state = _session_states.get(session_id)
    if not state:
        raise HTTPException(status_code=400, detail="Session state not initialized. Create session first.")

    updates = await interviewer_node(state)
    state.update(updates)

    # Persist question to DB
    turn = state["turn_count"] + 1
    msg = save_message(
        session_id=session_id,
        role="interviewer",
        content=state["current_question"],
        turn_number=turn,
    )
    state["messages"].append({
        "role": "interviewer",
        "content": state["current_question"],
        "turn_number": turn,
        "id": msg["id"],
    })

    return {
        "question": state["current_question"],
        "tts_audio": state["tts_audio"],
        "turn": turn,
        "difficulty": state["difficulty"],
        "session_complete": False,
    }


@router.post("/{session_id}/turn")
async def submit_turn(
    session_id: str,
    body: TurnRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
):
    """
    Submit user answer → run grader → followup → coach → optionally next question.
    Returns next question (or completion notice) + TTS + grading feedback.
    """
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != x_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    state = _session_states.get(session_id)
    if not state:
        raise HTTPException(status_code=400, detail="Session state not initialized")
    if state["session_complete"]:
        raise HTTPException(status_code=400, detail="Session already completed")

    state["current_answer"] = body.answer
    current_turn = state["turn_count"] + 1
    state["turn_count"] = current_turn

    # Save user answer
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

    # Grade the answer
    grader_updates = await grader_node(state)
    state.update(grader_updates)

    grading = state["grading"]
    competency = grading.get("competency", "general")
    score = grading.get("score", 3)

    # Update persisted user message with score
    from db.client import get_client
    get_client().table("messages").update({
        "competency": competency,
        "score": score,
    }).eq("id", user_msg["id"]).execute()

    # Index answer for RAG
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
        pass  # Non-critical; don't fail the turn

    # Check for follow-up
    followup_updates = await followup_node(state)
    state.update(followup_updates)

    # Coach node: update notes, calibrate difficulty
    coach_updates = await coach_node(state)
    state.update(coach_updates)

    if state["session_complete"]:
        complete_session(session_id, state["difficulty"])
        _build_final_report(state, session_id)
        return {
            "session_complete": True,
            "grading": grading,
            "coaching_note": state["coaching_notes"][-1] if state["coaching_notes"] else "",
            "question": None,
            "tts_audio": None,
            "turn": current_turn,
            "difficulty": state["difficulty"],
        }

    # Get next question (follow-up or new)
    interviewer_updates = await interviewer_node(state)
    state.update(interviewer_updates)

    next_turn = current_turn + 1
    next_msg = save_message(
        session_id=session_id,
        role="interviewer",
        content=state["current_question"],
        turn_number=next_turn,
        is_followup=state.get("follow_up_needed", False),
    )
    state["messages"].append({
        "role": "interviewer",
        "content": state["current_question"],
        "turn_number": next_turn,
        "is_followup": state.get("follow_up_needed", False),
        "id": next_msg["id"],
    })

    return {
        "session_complete": False,
        "grading": grading,
        "coaching_note": state["coaching_notes"][-1] if state["coaching_notes"] else "",
        "question": state["current_question"],
        "tts_audio": state["tts_audio"],
        "turn": next_turn,
        "difficulty": state["difficulty"],
        "is_followup": state.get("follow_up_needed", False),
    }


@router.get("/{session_id}/report")
async def get_report(session_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
    """Return the full post-interview coaching report."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != x_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    messages = get_messages(session_id)
    competency_scores = get_competency_scores(session_id)

    state = _session_states.get(session_id, {})
    coaching_notes = state.get("coaching_notes", [])

    # Build overall score
    scored_messages = [m for m in messages if m.get("score") is not None]
    overall_score = (
        sum(m["score"] for m in scored_messages) / len(scored_messages)
        if scored_messages else 0
    )

    return {
        "session": session,
        "overall_score": round(overall_score, 2),
        "competency_scores": competency_scores,
        "coaching_notes": coaching_notes,
        "messages": messages,
        "total_turns": len([m for m in messages if m["role"] == "user"]),
    }


@router.get("/{session_id}/history")
async def get_history(session_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != x_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"messages": get_messages(session_id)}


def _build_final_report(state: InterviewState, session_id: str) -> None:
    """Persist final coaching summary as a coach message."""
    if not state.get("coaching_notes"):
        return
    summary = "\n".join(f"• {note}" for note in state["coaching_notes"])
    save_message(
        session_id=session_id,
        role="coach",
        content=summary,
        turn_number=state["turn_count"] + 1,
    )
