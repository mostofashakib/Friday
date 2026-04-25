# Developed by Mostofa Shakib (www.mostofashakib.com)
from __future__ import annotations
from agents.state import InterviewState
from llm.manager import get_llm
from utils.json_utils import parse_llm_json

GRADER_SYSTEM = """You are an expert interview evaluator. Evaluate the candidate's answer and return a JSON object.

Return ONLY valid JSON with this exact structure:
{
  "score": <integer 1-5>,
  "competency": "<primary competency demonstrated>",
  "feedback": "<2-3 sentence constructive feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "follow_up_suggestion": "<optional: suggested follow-up question if answer was weak or incomplete, else null>"
}

Scoring rubric:
1 = No meaningful answer or completely off-topic
2 = Partial answer, missing key elements
3 = Adequate answer, covers basics
4 = Strong answer, well-structured, specific examples
5 = Exceptional answer, demonstrates mastery
"""


def _update_competency_scores(
    current_scores: dict, competency: str, new_score: int
) -> dict:
    """Rolling average: blend new score with existing score for the competency."""
    updated = dict(current_scores)
    if competency in updated:
        updated[competency] = (updated[competency] + new_score) / 2
    else:
        updated[competency] = float(new_score)
    return updated


async def grader_node(state: InterviewState) -> dict:
    prompt = (
        f"Question: {state['current_question']}\n\n"
        f"Candidate's answer: {state['current_answer']}\n\n"
        f"Interview type: {state['interview_type']}\n"
        f"Role: {state.get('role', 'Software Engineer')}\n"
        f"Difficulty level: {state['difficulty']}/5"
    )

    llm = get_llm()
    raw = await llm.complete(
        system=GRADER_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
    )

    grading = parse_llm_json(raw)
    competency = grading.get("competency", "general")
    score = grading.get("score", 3)
    updated_scores = _update_competency_scores(
        state.get("competency_scores", {}), competency, score
    )

    return {
        "grading": grading,
        "competency_scores": updated_scores,
    }
