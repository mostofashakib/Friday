from __future__ import annotations
import asyncio
import os

import httpx

from llm.manager import get_llm

_GITHUB_API = "https://api.github.com"
_MAX_REPOS = 8


def _gh_headers(token: str | None = None) -> dict:
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "Friday-AI-Coach"}
    t = token or os.environ.get("GITHUB_TOKEN")
    if t:
        headers["Authorization"] = f"token {t}"
    return headers


async def get_github_repos(username: str, token: str | None = None) -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{_GITHUB_API}/users/{username}/repos",
            params={"sort": "updated", "per_page": _MAX_REPOS, "type": "public"},
            headers=_gh_headers(token),
        )
        resp.raise_for_status()
        return resp.json()


async def _get_readme(owner: str, repo: str, token: str | None = None) -> str:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{_GITHUB_API}/repos/{owner}/{repo}/readme",
            headers={**_gh_headers(token), "Accept": "application/vnd.github.v3.raw"},
        )
        if resp.status_code == 404:
            return ""
        resp.raise_for_status()
        return resp.text[:3000]


async def _summarize_repo(repo: dict, readme: str) -> str:
    llm = get_llm()
    topics = ", ".join(repo.get("topics", [])) or "none"
    prompt = (
        f"Repository: {repo['name']}\n"
        f"Description: {repo.get('description') or 'No description'}\n"
        f"Language: {repo.get('language') or 'Unknown'}\n"
        f"Stars: {repo.get('stargazers_count', 0)}\n"
        f"Topics: {topics}\n\n"
        f"README:\n{readme[:2000] if readme else 'No README'}\n\n"
        "Summarize this project in 2-3 sentences: what it does, the tech stack, and what skills it demonstrates."
    )
    return await llm.complete(
        system="You are a technical recruiter summarizing GitHub projects concisely.",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
    )


async def build_candidate_context(username: str, token: str | None = None) -> str:
    """Fetch repos, summarize each, return a combined candidate profile string."""
    try:
        repos = await get_github_repos(username, token)
    except Exception as e:
        return f"GitHub profile unavailable: {e}"

    if not repos:
        return f"No public repositories found for @{username}."

    async def process(repo: dict) -> str:
        try:
            readme = await _get_readme(repo["owner"]["login"], repo["name"], token)
            summary = await _summarize_repo(repo, readme)
            return f"**{repo['name']}**: {summary}"
        except Exception:
            return f"**{repo['name']}**: {repo.get('description') or 'No description'}"

    summaries = await asyncio.gather(*[process(r) for r in repos])
    project_list = "\n".join(str(s) for s in summaries)

    llm = get_llm()
    condensed = await llm.complete(
        system="You are summarizing a software engineer's GitHub profile for an interviewer. Be concise and factual.",
        messages=[{"role": "user", "content": (
            f"Based on these GitHub projects, write a 3-5 sentence candidate profile highlighting "
            f"their main technical skills, domains of experience, and notable work:\n\n{project_list}"
        )}],
        max_tokens=300,
    )

    return (
        f"Candidate GitHub Profile (@{username}):\n\n"
        f"{condensed}\n\n"
        f"Project Breakdown:\n{project_list}"
    )
