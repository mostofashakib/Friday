from __future__ import annotations
import json
import re


def parse_llm_json(raw: str) -> dict:
    """
    Parse JSON from an LLM response.
    Handles markdown code blocks and attempts partial extraction on failure.
    Returns a default dict if JSON cannot be parsed at all.
    """
    text = raw.strip()

    # Strip markdown fences
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to extract the first {...} block
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Fallback: return a safe default so the pipeline doesn't crash
    return {"score": 3, "competency": "general", "feedback": raw[:300], "strengths": [], "gaps": []}
