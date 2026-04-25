# Developed by Mostofa Shakib (www.mostofashakib.com)
from __future__ import annotations
from agents.state import InterviewState
from llm.manager import get_llm
from tools.agent_tools import COACH_TOOLS, make_tool_executor, decrement_budget
from tools.question_bank import normalize_competency

COACH_SYSTEM = """You are an expert interview coach managing a live interview session.

After reviewing this answer you have three tools to shape future questions:

  • ban_competency(competency, reason) — mark a topic as saturated when you have enough
    signal (2+ questions, stable score). The Interviewer will skip it entirely.

  • set_directive(directive) — write a specific instruction the Interviewer MUST follow
    next turn: change topic, demand concrete metrics, increase pressure, etc.
    One directive per turn is enough; make it actionable.

  • flag_for_human_review(reason, severity) — escalate if you detect wildly inconsistent
    answers, confusion, distress, or potential cheating.

Use tools proactively to steer coverage. Then output ONE concise coaching note (1-2 sentences)
that is specific and actionable — tell the candidate exactly what to improve.
Output ONLY the coaching note, no preamble."""


def calibrate_difficulty(current: int, scores: dict) -> int:
    """Adjust difficulty based on rolling average across all competency scores."""
    if not scores:
        return current
    avg = sum(scores.values()) / len(scores)
    if avg >= 4.0 and current < 5:
        return min(5, current + 1)
    if avg <= 2.0 and current > 1:
        return max(1, current - 1)
    return current


async def coach_node(state: InterviewState) -> dict:
    grading = state.get("grading", {})
    score = grading.get("score", 3)
    turn_count = state["turn_count"]
    max_turns = state.get("max_turns", 8)
    competency = grading.get("competency", "")

    coaching_notes = list(state.get("coaching_notes", []))

    if competency:
        decrement_budget(state, normalize_competency(competency))

    turns_left = max_turns - turn_count
    banned = state.get("banned_competencies", [])
    budget = state.get("question_budget", {})

    coverage_lines = []
    for comp, remaining in sorted(budget.items()):
        score_val = state.get("competency_scores", {}).get(comp)
        score_str = f"{score_val:.1f}/5" if score_val is not None else "untested"
        status = "BANNED" if comp in banned else f"{remaining}Q left"
        coverage_lines.append(f"  {comp}: {score_str} [{status}]")
    coverage = "\n".join(coverage_lines) if coverage_lines else "  (no questions asked yet)"

    msgs = state.get("messages", [])
    user_msgs = [m for m in msgs if m.get("role") == "user"]
    history_snippet = ""
    if len(user_msgs) >= 2:
        prev = user_msgs[-2]
        history_snippet = (
            f"\nPrevious answer (turn {prev.get('turn_number', '?')}): "
            f"{str(prev.get('content', ''))[:200]}"
        )

    prompt = (
        f"Question asked: {state['current_question']}\n"
        f"Candidate's answer: {state['current_answer']}\n"
        f"Score: {score}/5  |  Competency: {competency or 'unclassified'}\n"
        f"Feedback: {grading.get('feedback', '')}\n"
        f"Gaps: {', '.join(grading.get('gaps', []) or ['none'])}\n"
        f"Turn {turn_count} of {max_turns} ({turns_left} turns remaining)"
        f"{history_snippet}\n\n"
        f"Session coverage so far:\n{coverage}\n\n"
        "Decide now: should any competency be banned? Does the Interviewer need a directive? "
        "Then write the coaching note."
    )

    llm = get_llm()
    note = await llm.complete_with_tools(
        system=COACH_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        tools=COACH_TOOLS,
        tool_executor=make_tool_executor(state),
        max_tokens=400,
    )
    coaching_notes.append(note)

    new_difficulty = calibrate_difficulty(state["difficulty"], state.get("competency_scores", {}))

    return {
        "coaching_notes": coaching_notes,
        "difficulty": new_difficulty,
        "session_complete": turn_count >= max_turns,
        "turn_count": turn_count,
        "banned_competencies": state.get("banned_competencies", []),
        "question_budget": state.get("question_budget", {}),
        "coach_directives": state.get("coach_directives", []),
    }
