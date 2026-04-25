from __future__ import annotations
from agents.state import InterviewState
from llm.manager import get_llm
from tools.agent_tools import INTERVIEWER_TOOLS, make_tool_executor

DIFFICULTY_LABELS = {1: "entry-level", 2: "junior", 3: "mid-level", 4: "senior", 5: "staff/principal"}

SYSTEM_PROMPTS = {
    "behavioral": (
        "You are a senior engineering manager conducting a behavioral interview.\n"
        "You have two tools available:\n"
        "  • search_question_bank(competency, difficulty) — retrieve a curated question. "
        "Use this first; only write a question yourself if the bank returns nothing.\n"
        "  • get_competency_history(competency) — check rolling score before picking a topic.\n\n"
        "RULES: Ask ONE question. No compound questions. Output ONLY the question text, no preamble."
    ),
    "technical": (
        "You are a senior staff engineer conducting a technical interview.\n"
        "Tools: search_question_bank, get_competency_history.\n\n"
        "RULES: Ask ONE focused technical question. Output ONLY the question text, no preamble."
    ),
    "general": (
        "You are a hiring manager conducting a general interview.\n"
        "Tools: search_question_bank, get_competency_history.\n\n"
        "RULES: Ask ONE role-relevant question. Output ONLY the question text, no preamble."
    ),
}


def _build_context(state: InterviewState) -> str:
    difficulty_label = DIFFICULTY_LABELS.get(state["difficulty"], "mid-level")
    role = state.get("role") or "Software Engineer"

    parts = [
        f"Role: {role}",
        f"Difficulty: {difficulty_label} (level {state['difficulty']}/5)",
        f"Interview type: {state['interview_type']}",
    ]

    directives = state.get("coach_directives", [])
    if directives:
        parts.append(
            "\n⚠ COACH DIRECTIVES — follow these for this question:\n"
            + "\n".join(f"  • {d}" for d in directives)
        )

    banned = state.get("banned_competencies", [])
    if banned:
        parts.append(f"\n🚫 BANNED competencies (do not ask about): {', '.join(banned)}")

    budget = state.get("question_budget", {})
    available = {c: r for c, r in budget.items() if r > 0 and c not in banned}
    untested = [c for c in available if c not in state.get("competency_scores", {})]
    if available:
        budget_lines = ", ".join(f"{c}({r}Q)" for c, r in sorted(available.items()))
        parts.append(f"\nRemaining question budget: {budget_lines}")
    if untested:
        parts.append(f"Untested competencies (prioritise these): {', '.join(untested)}")

    candidate_context = state.get("candidate_context", "")
    if candidate_context:
        parts.append(f"\nCandidate background:\n{candidate_context[:1500]}")

    competency_scores = state.get("competency_scores", {})
    if competency_scores:
        weak = [k for k, v in competency_scores.items() if v < 3.0 and k not in banned]
        if weak:
            parts.append(f"Known weak areas to probe: {', '.join(weak)}")

    history = state.get("messages", [])
    prior = [
        f"- Turn {m['turn_number']}: {m['content'][:120]}{'...' if len(m['content']) > 120 else ''}"
        for m in history[-6:]
        if m["role"] == "interviewer"
    ]
    if prior:
        parts.append("Prior questions asked (do not repeat):\n" + "\n".join(prior))

    parts.append(
        "\nSelect an appropriate competency from the budget above and write ONE interview question for it. "
        "Output ONLY the question text, nothing else."
    )
    return "\n".join(parts)


async def interviewer_node(state: InterviewState) -> dict:
    system = SYSTEM_PROMPTS.get(state["interview_type"], SYSTEM_PROMPTS["general"])

    if state.get("follow_up_needed") and state.get("follow_up_question"):
        question = state["follow_up_question"]
    else:
        llm = get_llm()
        question = await llm.complete_with_tools(
            system=system,
            messages=[{"role": "user", "content": _build_context(state)}],
            tools=INTERVIEWER_TOOLS,
            tool_executor=make_tool_executor(state),
            max_tokens=512,
        )

    return {
        "current_question": question,
        "follow_up_needed": False,
        "follow_up_question": "",
        "coach_directives": [],
    }
