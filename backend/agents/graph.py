# Developed by Mostofa Shakib (www.mostofashakib.com)
from __future__ import annotations
from langgraph.graph import StateGraph, END

from agents.state import InterviewState
from agents.interviewer import interviewer_node
from agents.grader import grader_node
from agents.clarifier import clarifier_node
from agents.followup import followup_node
from agents.coach import coach_node


# ── Routing functions ─────────────────────────────────────────────────────────

def route_after_grader(state: InterviewState) -> str:
    """
    Branch on the grader's score:
      1–2  → clarifier  (very weak — probe foundations before moving on)
      3–4  → followup   (adequate/good — check if a targeted follow-up helps)
      5    → coach      (exceptional — skip follow-up, reward with harder question)
    """
    score = state.get("grading", {}).get("score", 3)
    if score <= 2:
        return "clarifier"
    if score == 5:
        return "coach"
    return "followup"


def route_after_followup(state: InterviewState) -> str:
    """
    If followup_node decided a follow-up is needed, let interviewer_node
    serve it. Otherwise proceed to coach.
    """
    if state.get("follow_up_needed"):
        return "interviewer"
    return "coach"


def route_after_coach(state: InterviewState) -> str:
    if state.get("session_complete"):
        return END
    return "interviewer"


# ── Graph definition ──────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    g = StateGraph(InterviewState)

    g.add_node("interviewer", interviewer_node)
    g.add_node("grader", grader_node)
    g.add_node("clarifier", clarifier_node)
    g.add_node("followup", followup_node)
    g.add_node("coach", coach_node)

    g.set_entry_point("interviewer")

    # After grader: branch into clarifier / followup / coach
    g.add_conditional_edges(
        "grader",
        route_after_grader,
        {"clarifier": "clarifier", "followup": "followup", "coach": "coach"},
    )

    # Clarifier always goes to coach (never loops back to interviewer directly)
    g.add_edge("clarifier", "coach")

    # After followup: either serve the follow-up or move to coach
    g.add_conditional_edges(
        "followup",
        route_after_followup,
        {"interviewer": "interviewer", "coach": "coach"},
    )

    # After coach: end or next question
    g.add_conditional_edges(
        "coach",
        route_after_coach,
        {"interviewer": "interviewer", END: END},
    )

    return g


compiled_graph = build_graph().compile()
