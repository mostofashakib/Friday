"""
Stateless orchestration of the interview agent pipeline.

Owns agent routing and trace-building. No DB calls, no HTTP concerns, no audio
synthesis — those belong at the API boundary. Returns structured TurnResult.
"""
from __future__ import annotations
from dataclasses import dataclass, field

from agents.state import InterviewState
from agents.interviewer import interviewer_node
from agents.grader import grader_node
from agents.clarifier import clarifier_node
from agents.followup import followup_node
from agents.coach import coach_node
from agents.graph import route_after_grader, route_after_followup


@dataclass
class TurnResult:
    grading: dict
    coaching_note: str
    question: str | None          # next question text (None when session is complete)
    is_followup: bool
    route: str                    # "clarifier" | "followup" | "coach"
    session_complete: bool
    difficulty: int
    trace: list[dict] = field(default_factory=list)
    immediate_followup: bool = False  # True when followup short-circuits the coach


async def run_turn(state: InterviewState) -> TurnResult:
    """
    Execute the full agent pipeline for one interview turn.
    Expects state["current_answer"] to be set before calling.
    """
    state["clarifier_active"] = False
    state["follow_up_needed"] = False
    state["follow_up_question"] = ""
    state["agent_trace"] = []
    trace = state["agent_trace"]

    # ── Grade ──────────────────────────────────────────────────────────────────
    state.update(await grader_node(state))
    grading = state["grading"]
    score = grading.get("score", 3)
    competency = grading.get("competency", "general")
    trace.append({"node": "grader", "decision": f"score={score}, competency={competency}"})

    # ── Route after grader ────────────────────────────────────────────────────
    branch = route_after_grader(state)
    trace.append({"node": "router", "decision": f"score={score} → routing to {branch}"})

    if branch == "clarifier":
        state.update(await clarifier_node(state))
        trace.append({
            "node": "clarifier",
            "decision": f"weak answer on '{competency}', generating probing question",
        })

    elif branch == "followup":
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

        follow_route = route_after_followup(state)
        trace.append({"node": "router", "decision": f"followup → {follow_route}"})

        if follow_route == "interviewer":
            # Serve follow-up immediately — skip coach this turn
            state.update(await interviewer_node(state))
            trace.append({"node": "interviewer", "decision": "serving follow-up question immediately"})
            return TurnResult(
                grading=grading,
                coaching_note="",
                question=state["current_question"],
                is_followup=True,
                route="followup",
                session_complete=False,
                difficulty=state["difficulty"],
                trace=trace,
                immediate_followup=True,
            )

    # branch == "coach" (score 5) falls through here

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
    trace.append({
        "node": "coach",
        "decision": f"{avg_str}, {diff_str}, session_complete={state['session_complete']}",
    })

    if state["session_complete"]:
        return TurnResult(
            grading=grading,
            coaching_note=state["coaching_notes"][-1] if state["coaching_notes"] else "",
            question=None,
            is_followup=False,
            route=branch,
            session_complete=True,
            difficulty=state["difficulty"],
            trace=trace,
        )

    # ── Next question ──────────────────────────────────────────────────────────
    state.update(await interviewer_node(state))
    is_clarifier = branch == "clarifier"
    trace.append({
        "node": "interviewer",
        "decision": (
            f"serving clarifier probe for '{competency}'" if is_clarifier
            else f"selecting next question at difficulty {state['difficulty']}"
        ),
    })

    return TurnResult(
        grading=grading,
        coaching_note=state["coaching_notes"][-1] if state["coaching_notes"] else "",
        question=state["current_question"],
        is_followup=is_clarifier,
        route=branch,
        session_complete=False,
        difficulty=state["difficulty"],
        trace=trace,
    )
