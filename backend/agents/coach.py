from __future__ import annotations
import os
import anthropic
from agents.state import InterviewState

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

COACH_SYSTEM = """You are an expert interview coach. After each answer, provide ONE concise coaching insight (1-2 sentences).
Focus on what the candidate can do better. Be specific and actionable.
Output ONLY the coaching note, no preamble."""


async def coach_node(state: InterviewState) -> dict:
    grading = state.get("grading", {})
    score = grading.get("score", 3)
    turn_count = state["turn_count"]
    max_turns = state.get("max_turns", 8)

    coaching_notes = list(state.get("coaching_notes", []))

    # Generate coaching note for this turn
    prompt = (
        f"Question: {state['current_question']}\n"
        f"Answer: {state['current_answer']}\n"
        f"Score: {score}/5\n"
        f"Feedback: {grading.get('feedback', '')}\n"
        f"Gaps: {', '.join(grading.get('gaps', []))}"
    )
    response = _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=COACH_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    coaching_notes.append(response.content[0].text.strip())

    # Calibrate difficulty: adjust based on rolling score
    difficulty = state["difficulty"]
    competency_scores = state.get("competency_scores", {})
    if competency_scores:
        avg_score = sum(competency_scores.values()) / len(competency_scores)
        if avg_score >= 4.0 and difficulty < 5:
            difficulty = min(5, difficulty + 1)
        elif avg_score <= 2.0 and difficulty > 1:
            difficulty = max(1, difficulty - 1)

    session_complete = turn_count >= max_turns

    return {
        "coaching_notes": coaching_notes,
        "difficulty": difficulty,
        "session_complete": session_complete,
        "turn_count": turn_count,
    }
