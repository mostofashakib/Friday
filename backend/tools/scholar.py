from __future__ import annotations
import asyncio

from llm.manager import get_llm

_MAX_PUBS = 10


def _fetch_author_sync(author_name: str) -> dict | None:
    """Synchronous scholarly fetch — runs in a thread to avoid blocking the event loop."""
    from scholarly import scholarly
    results = scholarly.search_author(author_name)
    author = next(results, None)
    if not author:
        return None
    scholarly.fill(author, sections=["basics", "publications"])
    return author


async def build_scholar_context(author_name: str) -> str:
    """Search Google Scholar for an author and return a research profile string."""
    try:
        author = await asyncio.wait_for(
            asyncio.to_thread(_fetch_author_sync, author_name),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        return f"Google Scholar lookup timed out for '{author_name}'."
    except Exception as e:
        return f"Google Scholar lookup failed: {e}"

    if not author:
        return f"No Google Scholar profile found for '{author_name}'."

    name = author.get("name", author_name)
    affiliation = author.get("affiliation", "Unknown affiliation")
    h_index = author.get("hindex", "N/A")
    citations = author.get("citedby", 0)
    interests = ", ".join(author.get("interests", [])) or "Not listed"

    pubs = author.get("publications", [])[:_MAX_PUBS]
    pub_lines = []
    for pub in pubs:
        bib = pub.get("bib", {})
        title = bib.get("title", "Untitled")
        year = bib.get("pub_year", "")
        venue = bib.get("venue", "")
        cited = pub.get("num_citations", 0)
        parts = [title]
        if year:
            parts.append(f"({year})")
        if venue:
            parts.append(f"— {venue}")
        parts.append(f"[{cited} citations]")
        pub_lines.append("- " + " ".join(parts))

    pub_list = "\n".join(pub_lines) if pub_lines else "No publications indexed."

    llm = get_llm()
    summary = await llm.complete(
        system="You are summarizing a researcher's academic profile for a technical interviewer. Be concise and factual.",
        messages=[{"role": "user", "content": (
            f"Write a 3-4 sentence research profile for:\n\n"
            f"Name: {name}\n"
            f"Affiliation: {affiliation}\n"
            f"Research interests: {interests}\n"
            f"H-index: {h_index} | Total citations: {citations}\n\n"
            f"Top publications:\n{pub_list}\n\n"
            "Highlight their research domains, notable contributions, and academic impact."
        )}],
        max_tokens=250,
    )

    return (
        f"Google Scholar Profile ({name}):\n\n"
        f"{summary}\n\n"
        f"Affiliation: {affiliation}\n"
        f"H-index: {h_index} | Citations: {citations}\n"
        f"Research interests: {interests}\n\n"
        f"Publications:\n{pub_list}"
    )
