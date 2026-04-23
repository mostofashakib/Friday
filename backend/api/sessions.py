from __future__ import annotations
import asyncio
import os

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from pydantic import BaseModel

from agents.state import InterviewState
from agents.interviewer import interviewer_node
from agents.grader import grader_node
from agents.clarifier import clarifier_node
from agents.followup import followup_node
from agents.coach import coach_node
from agents.graph import route_after_grader, route_after_followup, route_after_coach
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

router = APIRouter()
MAX_TURNS = int(os.getenv("MAX_TURNS", "8"))

_session_states: dict[str, InterviewState] = {}


class TurnRequest(BaseModel):
    answer: str


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
    """Create a new interview session with optional candidate context."""
    if interview_type not in ("behavioral", "technical", "general"):
        raise HTTPException(status_code=400, detail="Invalid interview_type")
    if not (1 <= difficulty <= 5):
        raise HTTPException(status_code=400, detail="Difficulty must be 1-5")

    session = create_session(
        user_id=x_user_id,
        interview_type=interview_type,
        role=role,
    )
    session_id = session["id"]

    # Fetch all context sources concurrently
    candidate_context = ""
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

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        parts = [r for r in results if isinstance(r, str) and r.strip()]
        candidate_context = "\n\n---\n\n".join(parts)

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
    Submit an answer. Runs the graded routing pipeline:
      score 1–2 → clarifier → coach
      score 3–4 → followup  → coach  (followup may set a follow-up question)
      score 5   →              coach  (skip straight through, harder next question)
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

    # Reset per-turn flags
    state["current_answer"] = body.answer
    state["clarifier_active"] = False
    state["follow_up_needed"] = False
    state["follow_up_question"] = ""
    state["agent_trace"] = []
    trace = state["agent_trace"]

    current_turn = state["turn_count"] + 1
    state["turn_count"] = current_turn

    # Persist user answer
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

    # ── Grade ──────────────────────────────────────────────────────────────────
    state.update(await grader_node(state))
    grading = state["grading"]
    score = grading.get("score", 3)
    competency = grading.get("competency", "general")
    trace.append({"node": "grader", "decision": f"score={score}, competency={competency}"})

    # Back-fill score onto the user message
    update_message_score(user_msg["id"], competency, score)

    # Index for RAG (non-critical)
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

    # ── Conditional routing after grader ──────────────────────────────────────
    branch = route_after_grader(state)
    trace.append({"node": "router", "decision": f"score={score} → routing to {branch}"})

    if branch == "clarifier":
        # Score 1–2: generate a probing clarifier question
        state.update(await clarifier_node(state))
        trace.append({
            "node": "clarifier",
            "decision": f"weak answer on '{competency}', generating probing question",
        })

    elif branch == "followup":
        # Score 3–4: decide whether a targeted follow-up is warranted
        state.update(await followup_node(state))
        follow_up_needed = state.get("follow_up_needed", False)
        trace.append({
            "node": "followup",
            "decision": (
                f"RAG gap detected on '{competency}', triggering targeted question"
                if follow_up_needed
                else "no follow-up gaps found, proceeding to coach"
            ),
        })

        # If followup decided a follow-up IS needed, the interviewer will serve
        # it — skip coach this turn so the follow-up fires immediately.
        follow_route = route_after_followup(state)
        trace.append({"node": "router", "decision": f"followup → {follow_route}"})
        if follow_route == "interviewer":
            state.update(await interviewer_node(state))
            trace.append({"node": "interviewer", "decision": "serving follow-up question immediately"})
            next_turn = current_turn + 1
            next_msg = save_message(
                session_id=session_id,
                role="interviewer",
                content=state["current_question"],
                turn_number=next_turn,
                is_followup=True,
            )
            state["messages"].append({
                "role": "interviewer",
                "content": state["current_question"],
                "turn_number": next_turn,
                "is_followup": True,
                "id": next_msg["id"],
            })
            return {
                "session_complete": False,
                "grading": grading,
                "coaching_note": "",
                "question": state["current_question"],
                "tts_audio": state["tts_audio"],
                "turn": next_turn,
                "difficulty": state["difficulty"],
                "is_followup": True,
                "route": "followup",
                "agent_trace": trace,
            }

    # branch == "coach" (score 5) falls through directly here

    # ── Coach ──────────────────────────────────────────────────────────────────
    old_difficulty = state["difficulty"]
    state.update(await coach_node(state))
    comp_scores = state.get("competency_scores", {})
    rolling_avg = sum(comp_scores.values()) / len(comp_scores) if comp_scores else None
    avg_str = f"rolling avg {rolling_avg:.1f}" if rolling_avg is not None else "no scores yet"
    diff_str = (
        f"difficulty raised to {state['difficulty']}" if state["difficulty"] > old_difficulty
        else f"difficulty lowered to {state['difficulty']}" if state["difficulty"] < old_difficulty
        else f"difficulty held at {state['difficulty']}"
    )
    trace.append({"node": "coach", "decision": f"{avg_str}, {diff_str}, session_complete={state['session_complete']}"})

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
            "route": branch,
            "agent_trace": trace,
        }

    # ── Next question ──────────────────────────────────────────────────────────
    # For clarifier (score 1-2): interviewer_node picks up follow_up_question
    # For score 5: interviewer_node generates a fresh, harder question
    state.update(await interviewer_node(state))
    trace.append({
        "node": "interviewer",
        "decision": (
            f"serving clarifier probe for '{competency}'" if branch == "clarifier"
            else f"selecting next question at difficulty {state['difficulty']}"
        ),
    })

    next_turn = current_turn + 1
    is_clarifier = branch == "clarifier"
    next_msg = save_message(
        session_id=session_id,
        role="interviewer",
        content=state["current_question"],
        turn_number=next_turn,
        is_followup=is_clarifier,
    )
    state["messages"].append({
        "role": "interviewer",
        "content": state["current_question"],
        "turn_number": next_turn,
        "is_followup": is_clarifier,
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
        "is_followup": is_clarifier,
        "route": branch,   # "clarifier" | "followup" | "coach"
        "human_review_flag": state.get("human_review_flag"),
        "agent_trace": trace,
    }


@router.get("/{session_id}/report")
async def get_report(session_id: str, x_user_id: str = Header(..., alias="X-User-Id")):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != x_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    messages = get_messages(session_id)
    competency_scores = get_competency_scores(session_id)
    state = _session_states.get(session_id, {})
    coaching_notes = state.get("coaching_notes", [])

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
    if not state.get("coaching_notes"):
        return
    summary = "\n".join(f"• {note}" for note in state["coaching_notes"])
    save_message(
        session_id=session_id,
        role="coach",
        content=summary,
        turn_number=state["turn_count"] + 1,
    )
