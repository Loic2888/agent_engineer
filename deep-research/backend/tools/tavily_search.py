import logging
import os
from tavily import AsyncTavilyClient

logger = logging.getLogger(__name__)


async def search_tavily(query: str, max_results: int = 5) -> list[dict]:
    try:
        client = AsyncTavilyClient(api_key=os.environ["TAVILY_API_KEY"])
        response = await client.search(query, max_results=max_results)
        return [
            {
                "url": r.get("url", ""),
                "title": r.get("title", ""),
                "content": r.get("content", ""),
                "score": r.get("score", 0.0),
                "source": "tavily",
            }
            for r in response.get("results", [])
        ]
    except Exception as e:
        logger.error("Tavily search failed: %s", e)
        return []
