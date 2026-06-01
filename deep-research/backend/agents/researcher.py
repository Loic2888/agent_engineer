import asyncio
import logging
from graph.state import ResearchState
from tools.tavily_search import search_tavily
from tools.serp_search import search_serp
from tools.scraper import scrape_url

logger = logging.getLogger(__name__)


async def _research_question(question: str) -> list[dict]:
    sources = await search_tavily(question, max_results=5)
    if len(sources) < 3:
        fallback = await search_serp(question, max_results=5)
        sources.extend(fallback)

    urls = [s["url"] for s in sources[:3] if s.get("url")]
    scraped = await asyncio.gather(*[scrape_url(url) for url in urls])
    for source, content in zip(sources[:3], scraped):
        if content:
            source["scraped_content"] = content

    return sources


async def run_researcher(state: ResearchState) -> dict:
    sub_questions = state.get("sub_questions", [])
    results = await asyncio.gather(*[_research_question(q) for q in sub_questions])

    new_sources: list[dict] = []
    for result in results:
        new_sources.extend(result)

    logger.info("Researcher: %d new sources collected", len(new_sources))
    return {
        "raw_sources": new_sources,
        "status": "researcher",
        "iteration": state.get("iteration", 0) + 1,
    }
