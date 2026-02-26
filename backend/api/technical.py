import json
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

# Load problems once at module import time
_DATA_PATH = Path(__file__).parent.parent / "data" / "problems.json"

with open(_DATA_PATH) as f:
    _ALL_PROBLEMS: list[dict] = json.load(f)


def _pick_problems(session_id: str) -> list[dict]:
    """Deterministically pick 2 balanced problems seeded by session_id."""
    seed = sum(ord(c) for c in session_id)

    def _hash(problem_id: int) -> int:
        return ((seed * problem_id * 2654435761) & 0xFFFFFFFF)

    shuffled = sorted(_ALL_PROBLEMS, key=lambda p: _hash(p["id"]))

    easy = next((p for p in shuffled if p["difficulty"] != "Hard"), shuffled[0])
    hard = next(
        (p for p in shuffled if p is not easy and p["difficulty"] != "Easy"),
        shuffled[1],
    )
    return [easy, hard]


@router.get("/{session_id}/technical-problems")
async def get_technical_problems(session_id: str) -> dict:
    """Return 2 balanced DSA problems for a technical interview session."""
    try:
        problems = _pick_problems(session_id)
        return {"problems": problems}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
