from __future__ import annotations
from langgraph.graph import StateGraph, END
from agents.state import InterviewState
from agents.interviewer import interviewer_node
from agents.grader import grader_node
from agents.followup import followup_node
from agents.coach import coach_node


def _should_followup(state: InterviewState) -> str:
    """Route after followup_node: re-interview with follow-up or move to coach."""
    if state.get("follow_up_needed"):
        return "interviewer"
    return "coach"


def _should_continue(state: InterviewState) -> str:
    """Route after coach_node: continue interview or end session."""
    if state.get("session_complete"):
        return END
    return "interviewer"


def build_graph() -> StateGraph:
    graph = StateGraph(InterviewState)

    graph.add_node("interviewer", interviewer_node)
    graph.add_node("grader", grader_node)
    graph.add_node("followup", followup_node)
    graph.add_node("coach", coach_node)

    graph.set_entry_point("interviewer")

    # interviewer → (wait for answer via API) → grader
    graph.add_edge("grader", "followup")
    graph.add_conditional_edges("followup", _should_followup, {
        "interviewer": "interviewer",
        "coach": "coach",
    })
    graph.add_conditional_edges("coach", _should_continue, {
        "interviewer": "interviewer",
        END: END,
    })

    return graph


# Compiled graph — used by API layer
compiled_graph = build_graph().compile()
