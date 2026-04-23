from __future__ import annotations
import re

import httpx

from llm.manager import get_llm

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def _strip_html(html: str) -> str:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "noscript", "iframe"]):
            tag.decompose()
        return soup.get_text(separator="\n", strip=True)
    except ImportError:
        text = re.sub(r"<[^>]+>", " ", html)
        return re.sub(r"\s+", " ", text).strip()


async def fetch_job_description(url: str) -> str:
    """Fetch a job posting URL and extract the structured job description."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            page_text = _strip_html(resp.text)
    except Exception as e:
        return f"Could not fetch job posting ({e}). The interview will proceed without job context."

    llm = get_llm()
    extracted = await llm.complete(
        system="You are extracting job description information from web page text. Be concise and factual.",
        messages=[{"role": "user", "content": (
            "Extract the job description from this web page text. Include:\n"
            "- Company name and role title\n"
            "- Key responsibilities\n"
            "- Required skills and qualifications\n"
            "- Preferred/nice-to-have skills\n"
            "- Brief company or team description if available\n\n"
            "Return only the relevant job information. Ignore navigation, ads, and unrelated content.\n\n"
            f"Page text:\n{page_text[:5000]}"
        )}],
        max_tokens=600,
    )
    return f"Job Posting:\n{extracted}"
