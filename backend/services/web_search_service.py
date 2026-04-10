"""
Web Search Service — uses Tavily API to find trending content.
Falls back gracefully if API key is not set.
"""
import httpx
from typing import Optional
from config import settings

TAVILY_ENDPOINT = "https://api.tavily.com/search"


async def search_trending(query: str, max_results: int = 5) -> list[dict]:
    """Search for trending topics/videos related to a query."""
    if not settings.TAVILY_API_KEY:
        return []

    payload = {
        "api_key": settings.TAVILY_API_KEY,
        "query": query,
        "search_depth": "advanced",
        "max_results": max_results,
        "include_answer": True,
        "include_raw_content": False,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(TAVILY_ENDPOINT, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return []

    results = []
    for r in data.get("results", []):
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("content", ""),
            "score": r.get("score", 0),
        })
    return results


def format_search_results(results: list[dict]) -> str:
    """Format search results for inclusion in a prompt."""
    if not results:
        return ""
    lines = ["=== XU HƯỚNG TỪ INTERNET ==="]
    for i, r in enumerate(results, 1):
        lines.append(f"\n{i}. {r['title']}")
        lines.append(f"   URL: {r['url']}")
        lines.append(f"   Tóm tắt: {r['snippet'][:300]}")
    lines.append("=============================")
    return "\n".join(lines)
