import json
import os
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


# ── Dependency: cached problem loader ────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_problems() -> tuple[dict, ...]:
    """Read problems.json once and cache it for the process lifetime.

    Path is resolved from the PROBLEMS_DATA_PATH env var so it can be
    overridden in tests or different deployment environments without
    touching source code.  Falls back to 'data/problems.json' relative
    to the working directory (i.e. backend/).
    """
    data_path = Path(os.getenv("PROBLEMS_DATA_PATH", "data/problems.json"))
    with open(data_path) as f:
        return tuple(json.load(f))


def get_problems() -> tuple[dict, ...]:
    """FastAPI dependency that returns the immutable problems collection."""
    return _load_problems()


# ── Problem selection logic ───────────────────────────────────────────────────

def _pick_two(session_id: str, all_problems: tuple[dict, ...]) -> list[dict]:
    """Deterministically pick 2 balanced problems seeded by session_id."""
    seed = sum(ord(c) for c in session_id)

    def _hash(problem_id: int) -> int:
        return (seed * problem_id * 2654435761) & 0xFFFFFFFF

    shuffled = sorted(all_problems, key=lambda p: _hash(p["id"]))

    easy = next((p for p in shuffled if p["difficulty"] != "Hard"), shuffled[0])
    hard = next(
        (p for p in shuffled if p is not easy and p["difficulty"] != "Easy"),
        shuffled[1],
    )
    return [easy, hard]


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/technical-problems")
async def get_technical_problems(
    session_id: str,
    problems: tuple[dict, ...] = Depends(get_problems),
) -> dict:
    """Return 2 balanced DSA problems for a technical interview session."""
    try:
        return {"problems": _pick_two(session_id, problems)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
