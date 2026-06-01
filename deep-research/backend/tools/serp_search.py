import asyncio
import logging
import os
from functools import partial
from serpapi import GoogleSearch

logger = logging.getLogger(__name__)


def _sync_search(query: str, max_results: int) -> list[dict]:
    params = {
        "q": query,
        "api_key": os.environ["SERPAPI_API_KEY"],
        "num": max_results,
    }
    results = GoogleSearch(params).get_dict().get("organic_results", [])
    return [
        {
            "url": r.get("link", ""),
            "title": r.get("title", ""),
            "content": r.get("snippet", ""),
            "score": 0.5,
            "source": "serp",
        }
        for r in results[:max_results]
    ]


async def search_serp(query: str, max_results: int = 5) -> list[dict]:
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, partial(_sync_search, query, max_results))
        return results
    except Exception as e:
        logger.error("SerpAPI search failed: %s", e)
        return []
