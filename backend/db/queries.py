from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any
from db.client import get_client


# ── Sessions ──────────────────────────────────────────────────────────────────

def create_session(user_id: str, interview_type: str, role: str | None) -> dict:
    db = get_client()
    result = (
        db.table("sessions")
        .insert({
            "user_id": user_id,
            "interview_type": interview_type,
            "role": role,
        })
        .execute()
    )
    return result.data[0]


def get_session(session_id: str) -> dict | None:
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
        "completed_at": datetime.now(timezone.utc).isoformat(),
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


def get_messages(session_id: str) -> list[dict]:
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
            .update({
                "score": rolling_score,
                "attempts": attempts,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("session_id", session_id)
            .eq("competency", competency)
            .execute()
        )
    else:
        result = (
            db.table("competency_scores")
            .insert({
                "session_id": session_id,
                "competency": competency,
                "score": score,
                "attempts": 1,
            })
            .execute()
        )
    return result.data[0]


def get_competency_scores(session_id: str) -> list[dict]:
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
