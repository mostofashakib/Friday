from __future__ import annotations
from agents.state import InterviewState
from llm.manager import get_llm

CLARIFIER_SYSTEM = """You are a patient technical interviewer. The candidate gave a very weak or unclear answer.
Your job is to ask ONE short, targeted clarifying question that:
- Probes whether they understand the fundamentals behind their answer
- Gives them a chance to demonstrate basic knowledge they may have missed
- Does NOT re-ask the original question — go one level deeper

Keep it direct. Output ONLY the clarifying question, no preamble."""


async def clarifier_node(state: InterviewState) -> dict:
    """
    Triggered on score 1–2. Generates a probing question to test whether
    the candidate has any foundational understanding of the topic.
    """
    grading = state.get("grading", {})
    gaps = grading.get("gaps", [])
    gap_context = ", ".join(gaps) if gaps else "the candidate's response was unclear or off-topic"

    prompt = (
        f"Original question: {state['current_question']}\n"
        f"Candidate's answer: {state['current_answer']}\n"
        f"Score: {grading.get('score', 1)}/5\n"
        f"What was weak or missing: {gap_context}\n"
        f"Role context: {state.get('role', 'Software Engineer')}"
    )

    llm = get_llm()
    question = await llm.complete(
        system=CLARIFIER_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )

    return {
        "follow_up_needed": True,
        "follow_up_question": question,
        "clarifier_active": True,
    }
