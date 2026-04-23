from __future__ import annotations
import json


def parse_llm_json(raw: str) -> dict:
    """
    Parse JSON from an LLM response.
    Handles responses wrapped in markdown code blocks (```json ... ```).
    """
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
