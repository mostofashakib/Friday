from __future__ import annotations
from rag.embeddings import embed_text
from db.queries import find_similar_embeddings, save_embedding


async def index_answer(
    session_id: str,
    message_id: str,
    question: str,
    answer: str,
    competency: str | None,
    score: int | None,
) -> None:
    """Embed a Q&A pair and store it for future RAG retrieval."""
    combined = f"Question: {question}\nAnswer: {answer}"
    embedding = await embed_text(combined)
    save_embedding(
        session_id=session_id,
        message_id=message_id,
        embedding=embedding,
        content=combined,
        metadata={"competency": competency, "score": score},
    )


async def find_gaps(
    session_id: str,
    current_question: str,
    current_answer: str,
    threshold: float = 0.75,
    limit: int = 4,
) -> list[dict]:
    """
    Find semantically similar past Q&A pairs to detect recurring weaknesses.
    Returns list of similar documents with similarity scores.
    """
    query = f"Question: {current_question}\nAnswer: {current_answer}"
    embedding = await embed_text(query)
    return find_similar_embeddings(
        session_id=session_id,
        query_embedding=embedding,
        threshold=threshold,
        limit=limit,
    )
