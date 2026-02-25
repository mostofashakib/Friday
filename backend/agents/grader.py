from __future__ import annotations
import json
import os
import anthropic
from agents.state import InterviewState

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

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


async def grader_node(state: InterviewState) -> dict:
    prompt = (
        f"Question: {state['current_question']}\n\n"
        f"Candidate's answer: {state['current_answer']}\n\n"
        f"Interview type: {state['interview_type']}\n"
        f"Role: {state.get('role', 'Software Engineer')}\n"
        f"Difficulty level: {state['difficulty']}/5"
    )

    response = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=GRADER_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    grading = json.loads(raw.strip())

    # Update competency scores in state
    competency = grading.get("competency", "general")
    score = grading.get("score", 3)
    updated_scores = dict(state.get("competency_scores", {}))
    if competency in updated_scores:
        prev = updated_scores[competency]
        updated_scores[competency] = (prev + score) / 2
    else:
        updated_scores[competency] = float(score)

    return {
        "grading": grading,
        "competency_scores": updated_scores,
    }
