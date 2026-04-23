from __future__ import annotations
from agents.state import InterviewState
from llm.manager import get_llm
from rag.retriever import find_gaps

FOLLOWUP_SYSTEM = """You are an expert interviewer. Based on a weak or incomplete answer,
generate ONE targeted follow-up question that probes the specific gap identified.
The follow-up should help the candidate demonstrate understanding they may have missed.
Output ONLY the follow-up question text, no preamble."""


async def followup_node(state: InterviewState) -> dict:
    grading = state.get("grading", {})
    score = grading.get("score", 3)
    follow_up_suggestion = grading.get("follow_up_suggestion")
    gaps = grading.get("gaps", [])

    similar = []
    try:
        similar = await find_gaps(
            session_id=state["session_id"],
            current_question=state["current_question"],
            current_answer=state["current_answer"],
        )
    except Exception:
        pass

    recurring_weakness = any(
        doc.get("metadata", {}).get("score", 5) < 3
        for doc in similar
    )

    should_followup = score <= 2 or (score == 3 and (gaps or recurring_weakness))

    if not should_followup:
        return {"follow_up_needed": False, "follow_up_question": ""}

    if follow_up_suggestion:
        return {"follow_up_needed": True, "follow_up_question": follow_up_suggestion}

    gap_context = ", ".join(gaps) if gaps else "incomplete answer"
    prompt = (
        f"Original question: {state['current_question']}\n"
        f"Candidate answer: {state['current_answer']}\n"
        f"Identified gaps: {gap_context}\n"
        f"Role: {state.get('role', 'Software Engineer')}"
    )
    llm = get_llm()
    question = await llm.complete(
        system=FOLLOWUP_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=256,
    )
    return {"follow_up_needed": True, "follow_up_question": question}
