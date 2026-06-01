import logging
from graph.state import ResearchState

logger = logging.getLogger(__name__)

_MAX_SOURCES = 15
_MAX_CONTENT_CHARS = 2000


async def run_synthesizer(state: ResearchState) -> dict:
    raw_sources = state.get("raw_sources", [])

    seen: set[str] = set()
    unique: list[dict] = []
    for source in raw_sources:
        url = source.get("url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(source)

    unique.sort(key=lambda s: s.get("score", 0.0), reverse=True)
    ranked = unique[:_MAX_SOURCES]

    for source in ranked:
        for key in ("content", "scraped_content"):
            if source.get(key) and len(source[key]) > _MAX_CONTENT_CHARS:
                source[key] = source[key][:_MAX_CONTENT_CHARS]

    logger.info("Synthesizer: %d unique sources ranked", len(ranked))
    return {"ranked_sources": ranked, "status": "synthesizer"}
