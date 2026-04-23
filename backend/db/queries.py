from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any
from db.client import get_client, USE_LOCAL_DB

# ── In-memory store (active when SUPABASE_URL is not configured) ──────────────

_sessions: dict[str, dict] = {}
_messages: dict[str, list[dict]] = {}
_scores: dict[str, dict] = {}      # key: f"{session_id}:{competency}"
_embeddings: dict[str, list[dict]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Sessions ──────────────────────────────────────────────────────────────────

def create_session(user_id: str, interview_type: str, role: str | None) -> dict:
    if USE_LOCAL_DB:
        session = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "interview_type": interview_type,
            "role": role,
            "status": "active",
            "difficulty": 3,
            "created_at": _now(),
            "completed_at": None,
        }
        _sessions[session["id"]] = session
        return session

    db = get_client()
    result = (
        db.table("sessions")
        .insert({"user_id": user_id, "interview_type": interview_type, "role": role})
        .execute()
    )
    return result.data[0]


def get_session(session_id: str) -> dict | None:
    if USE_LOCAL_DB:
        return _sessions.get(session_id)

    db = get_client()
    result = (
        db.table("sessions")
        .select("*")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    return result.data


def update_session(session_id: str, updates: dict) -> dict:
    if USE_LOCAL_DB:
        _sessions[session_id].update(updates)
        return _sessions[session_id]

    db = get_client()
    result = (
        db.table("sessions")
        .update(updates)
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]


def complete_session(session_id: str, difficulty: int) -> dict:
    return update_session(session_id, {
        "status": "completed",
        "difficulty": difficulty,
        "completed_at": _now(),
    })


# ── Messages ──────────────────────────────────────────────────────────────────

def save_message(
    session_id: str,
    role: str,
    content: str,
    turn_number: int,
    competency: str | None = None,
    score: int | None = None,
    is_followup: bool = False,
) -> dict:
    if USE_LOCAL_DB:
        msg = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "role": role,
            "content": content,
            "competency": competency,
            "score": score,
            "turn_number": turn_number,
            "is_followup": is_followup,
            "created_at": _now(),
        }
        _messages.setdefault(session_id, []).append(msg)
        return msg

    db = get_client()
    result = (
        db.table("messages")
        .insert({
            "session_id": session_id,
            "role": role,
            "content": content,
            "competency": competency,
            "score": score,
            "turn_number": turn_number,
            "is_followup": is_followup,
        })
        .execute()
    )
    return result.data[0]


def update_message_score(message_id: str, competency: str, score: int) -> None:
    if USE_LOCAL_DB:
        for msgs in _messages.values():
            for m in msgs:
                if m["id"] == message_id:
                    m["competency"] = competency
                    m["score"] = score
                    return
        return

    get_client().table("messages").update({
        "competency": competency,
        "score": score,
    }).eq("id", message_id).execute()


def get_messages(session_id: str) -> list[dict]:
    if USE_LOCAL_DB:
        return sorted(_messages.get(session_id, []), key=lambda m: m["turn_number"])

    db = get_client()
    result = (
        db.table("messages")
        .select("*")
        .eq("session_id", session_id)
        .order("turn_number")
        .execute()
    )
    return result.data


# ── Competency scores ─────────────────────────────────────────────────────────

def upsert_competency_score(session_id: str, competency: str, score: float) -> dict:
    key = f"{session_id}:{competency}"

    if USE_LOCAL_DB:
        if key in _scores:
            entry = _scores[key]
            attempts = entry["attempts"] + 1
            entry["score"] = (entry["score"] * entry["attempts"] + score) / attempts
            entry["attempts"] = attempts
            entry["updated_at"] = _now()
        else:
            _scores[key] = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "competency": competency,
                "score": score,
                "attempts": 1,
                "updated_at": _now(),
            }
        return _scores[key]

    db = get_client()
    existing = (
        db.table("competency_scores")
        .select("*")
        .eq("session_id", session_id)
        .eq("competency", competency)
        .maybe_single()
        .execute()
    )
    if existing.data:
        attempts = existing.data["attempts"] + 1
        rolling_score = (existing.data["score"] * existing.data["attempts"] + score) / attempts
        result = (
            db.table("competency_scores")
            .update({"score": rolling_score, "attempts": attempts, "updated_at": _now()})
            .eq("session_id", session_id)
            .eq("competency", competency)
            .execute()
        )
    else:
        result = (
            db.table("competency_scores")
            .insert({"session_id": session_id, "competency": competency, "score": score, "attempts": 1})
            .execute()
        )
    return result.data[0]


def get_competency_scores(session_id: str) -> list[dict]:
    if USE_LOCAL_DB:
        return [v for k, v in _scores.items() if k.startswith(f"{session_id}:")]

    db = get_client()
    result = (
        db.table("competency_scores")
        .select("*")
        .eq("session_id", session_id)
        .execute()
    )
    return result.data


# ── Embeddings ────────────────────────────────────────────────────────────────

def save_embedding(
    session_id: str,
    message_id: str,
    embedding: list[float],
    content: str,
    metadata: dict | None = None,
) -> dict:
    if USE_LOCAL_DB:
        entry = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "message_id": message_id,
            "embedding": embedding,
            "content": content,
            "metadata": metadata or {},
        }
        _embeddings.setdefault(session_id, []).append(entry)
        return entry

    db = get_client()
    result = (
        db.table("message_embeddings")
        .insert({
            "session_id": session_id,
            "message_id": message_id,
            "embedding": embedding,
            "content": content,
            "metadata": metadata or {},
        })
        .execute()
    )
    return result.data[0]


def find_similar_embeddings(
    session_id: str,
    query_embedding: list[float],
    threshold: float = 0.75,
    limit: int = 5,
) -> list[dict]:
    if USE_LOCAL_DB:
        return []

    db = get_client()
    result = db.rpc(
        "match_session_embeddings",
        {
            "p_session_id": session_id,
            "query_embedding": query_embedding,
            "match_threshold": threshold,
            "match_count": limit,
        },
    ).execute()
    return result.data or []
