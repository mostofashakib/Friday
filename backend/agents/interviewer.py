from __future__ import annotations
import os
import anthropic
from agents.state import InterviewState
from tools.tts import generate_tts

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

DIFFICULTY_LABELS = {1: "entry-level", 2: "junior", 3: "mid-level", 4: "senior", 5: "staff/principal"}

SYSTEM_PROMPTS = {
    "behavioral": (
        "You are a senior engineering manager conducting a behavioral interview. "
        "Ask one STAR-format behavioral question at a time. "
        "Calibrate complexity to the specified difficulty level. "
        "Do not ask compound questions. Output ONLY the question text, no preamble."
    ),
    "technical": (
        "You are a senior staff engineer conducting a technical interview. "
        "Ask one focused technical question (algorithms, system design, or debugging) at a time. "
        "Calibrate depth and complexity to the specified difficulty level. "
        "Do not ask compound questions. Output ONLY the question text, no preamble."
    ),
    "general": (
        "You are a hiring manager conducting a general interview. "
        "Ask one clear, role-relevant question at a time. "
        "Calibrate complexity to the specified difficulty level. "
        "Do not ask compound questions. Output ONLY the question text, no preamble."
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

    if state["competency_scores"]:
        weak = [k for k, v in state["competency_scores"].items() if v < 3.0]
        if weak:
            parts.append(f"Known weak areas to probe: {', '.join(weak)}")

    history = state.get("messages", [])
    if history:
        prior = [
            f"- Turn {m['turn_number']}: {m['content'][:120]}..."
            if len(m["content"]) > 120
            else f"- Turn {m['turn_number']}: {m['content']}"
            for m in history[-6:]
            if m["role"] == "interviewer"
        ]
        if prior:
            parts.append("Prior questions asked (do not repeat):\n" + "\n".join(prior))

    return "\n".join(parts)


async def interviewer_node(state: InterviewState) -> dict:
    system = SYSTEM_PROMPTS.get(state["interview_type"], SYSTEM_PROMPTS["general"])

    if state.get("follow_up_needed") and state.get("follow_up_question"):
        question = state["follow_up_question"]
    else:
        context = _build_context(state)
        response = _client.messages.create(
            model="claude-opus-4-6",
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": context}],
        )
        question = response.content[0].text.strip()

    audio = await generate_tts(question, state["session_id"])

    return {
        "current_question": question,
        "tts_audio": audio,
        "follow_up_needed": False,
        "follow_up_question": "",
    }
