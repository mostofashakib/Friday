from __future__ import annotations
import io

from llm.manager import get_llm


async def _extract_text(file_bytes: bytes, content_type: str) -> str:
    if "pdf" in content_type.lower():
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    return file_bytes.decode("utf-8", errors="ignore")


async def parse_resume(file_bytes: bytes, content_type: str) -> str:
    """Extract and summarize resume content for the interviewer."""
    text = await _extract_text(file_bytes, content_type)
    if not text.strip():
        return ""

    llm = get_llm()
    return await llm.complete(
        system="You are summarizing a candidate's resume for an interviewer. Be concise and factual.",
        messages=[{"role": "user", "content": (
            "Extract key information from this resume and create a concise profile (5-7 sentences) covering: "
            "years of experience and seniority level, technical skills and programming languages, "
            "key roles and companies, notable projects or achievements, and educational background.\n\n"
            f"Resume:\n{text[:4000]}"
        )}],
        max_tokens=400,
    )
