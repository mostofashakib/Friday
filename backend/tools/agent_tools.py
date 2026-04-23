"""
Tool schemas, state mutators, and executor factory for interview agents.

Question data and lookup logic live in tools/question_bank.py.
"""
from __future__ import annotations
from typing import TYPE_CHECKING

from tools.question_bank import (
    ALL_COMPETENCIES,
    DEFAULT_QUESTION_BUDGET,
    normalize_competency,
    search_question_bank,
    get_competency_history,
)

if TYPE_CHECKING:
    from agents.state import InterviewState

# Backward-compatible alias (some internal callers used the private name).
_normalize_competency = normalize_competency

# Re-export so callers that import from agent_tools don't break.
__all__ = [
    "ALL_COMPETENCIES",
    "DEFAULT_QUESTION_BUDGET",
    "INTERVIEWER_TOOLS",
    "COACH_TOOLS",
    "make_tool_executor",
    "decrement_budget",
    "normalize_competency",
    "_normalize_competency",
]


# ── Tool schemas (Anthropic tool-use format) ──────────────────────────────────

SEARCH_QUESTION_BANK: dict = {
    "name": "search_question_bank",
    "description": (
        "Retrieve a curated, battle-tested question from the question bank for a given "
        "competency and difficulty. Prefer this over generating a fresh question when you "
        "want consistent quality. Returns a question string, or an empty string if none found."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "competency": {
                "type": "string",
                "description": (
                    "Competency area. One of: leadership, conflict_resolution, communication, "
                    "problem_solving, ownership, collaboration, adaptability, growth_mindset, execution"
                ),
            },
            "difficulty": {
                "type": "integer",
                "description": "Difficulty level 1–5 (1=entry, 2=junior, 3=mid, 4=senior, 5=staff/principal)",
            },
        },
        "required": ["competency", "difficulty"],
    },
}

GET_COMPETENCY_HISTORY: dict = {
    "name": "get_competency_history",
    "description": (
        "Query the candidate's performance history for a specific competency in this session. "
        "Returns rolling score, attempt count, and recent feedback. "
        "Use this before picking a topic to decide whether to re-probe a weakness or move on."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "competency": {
                "type": "string",
                "description": "The competency to look up (e.g. 'leadership', 'problem_solving')",
            },
        },
        "required": ["competency"],
    },
}

BAN_COMPETENCY: dict = {
    "name": "ban_competency",
    "description": (
        "Mark a competency as saturated — you have collected enough signal and the Interviewer "
        "should not ask about it again this session. Call this when you've seen 2+ questions on "
        "a topic and the score is stable (consistently high or consistently low)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "competency": {
                "type": "string",
                "description": "The competency to ban from future questions.",
            },
            "reason": {
                "type": "string",
                "description": "Why this competency is saturated.",
            },
        },
        "required": ["competency", "reason"],
    },
}

SET_DIRECTIVE: dict = {
    "name": "set_directive",
    "description": (
        "Add an explicit instruction that the Interviewer MUST follow when choosing the next question. "
        "Use this to steer the interview: change topic, adjust framing, increase pressure, "
        "or request a specific type of answer. The instruction is consumed after one turn."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "directive": {
                "type": "string",
                "description": (
                    "A clear, specific instruction. Examples: "
                    "'Push harder on technical specifics — candidate is giving vague high-level answers', "
                    "'Move to collaboration next, leadership is sufficiently covered'."
                ),
            },
        },
        "required": ["directive"],
    },
}

FLAG_FOR_HUMAN_REVIEW: dict = {
    "name": "flag_for_human_review",
    "description": (
        "Escalate this session for human review. Call this when you detect wildly inconsistent "
        "answers, indicators of confusion or distress, potential policy violations, or any "
        "situation you cannot properly assess. The session continues but is marked for review."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "reason": {
                "type": "string",
                "description": "Clear explanation of why this session needs human review.",
            },
            "severity": {
                "type": "string",
                "enum": ["low", "medium", "high"],
                "description": "Urgency: low=review within a week, medium=within 24h, high=immediately.",
            },
        },
        "required": ["reason", "severity"],
    },
}

INTERVIEWER_TOOLS = [SEARCH_QUESTION_BANK, GET_COMPETENCY_HISTORY]
COACH_TOOLS = [BAN_COMPETENCY, SET_DIRECTIVE, FLAG_FOR_HUMAN_REVIEW]


# ── State mutators (called by tool executor or directly by coach_node) ─────────

def flag_for_human_review(state: "InterviewState", reason: str, severity: str) -> str:
    state["human_review_flag"] = {
        "reason": reason,
        "severity": severity,
        "turn": state.get("turn_count", 0),
    }
    return f"Session flagged for human review (severity={severity}). Reason logged. Continue the interview normally."


def ban_competency(state: "InterviewState", competency: str, reason: str) -> str:
    key = normalize_competency(competency)
    banned = list(state.get("banned_competencies", []))
    if key not in banned:
        banned.append(key)
        state["banned_competencies"] = banned
    budget = dict(state.get("question_budget", {}))
    budget[key] = 0
    state["question_budget"] = budget
    return f"Competency '{key}' banned for this session. Reason: {reason}"


def set_directive(state: "InterviewState", directive: str) -> str:
    directives = list(state.get("coach_directives", []))
    directives.append(directive)
    state["coach_directives"] = directives
    return f"Directive added: {directive}"


def decrement_budget(state: "InterviewState", competency: str) -> bool:
    """
    Decrement question budget for a competency. Returns True if the competency
    was auto-banned (budget hit 0). Called by coach_node directly, not via LLM tool.
    """
    key = normalize_competency(competency)
    budget = dict(state.get("question_budget", {}))
    remaining = max(0, budget.get(key, DEFAULT_QUESTION_BUDGET) - 1)
    budget[key] = remaining
    state["question_budget"] = budget

    if remaining == 0:
        banned = list(state.get("banned_competencies", []))
        if key not in banned:
            banned.append(key)
            state["banned_competencies"] = banned
        return True
    return False


# ── Executor factory ──────────────────────────────────────────────────────────

def make_tool_executor(state: "InterviewState"):
    """Return an async callable that routes tool calls to the correct implementation."""
    async def executor(tool_name: str, tool_input: dict) -> str:
        match tool_name:
            case "search_question_bank":
                return search_question_bank(tool_input["competency"], tool_input["difficulty"])
            case "get_competency_history":
                return get_competency_history(state, tool_input["competency"])
            case "flag_for_human_review":
                return flag_for_human_review(state, tool_input["reason"], tool_input["severity"])
            case "ban_competency":
                return ban_competency(state, tool_input["competency"], tool_input["reason"])
            case "set_directive":
                return set_directive(state, tool_input["directive"])
            case _:
                return f"Unknown tool: {tool_name}"

    return executor
