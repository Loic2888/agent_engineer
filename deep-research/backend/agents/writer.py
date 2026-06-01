import logging
import google.generativeai as genai
from graph.state import ResearchState

logger = logging.getLogger(__name__)
_model = genai.GenerativeModel(
    "gemini-2.5-flash",
    generation_config=genai.GenerationConfig(max_output_tokens=8192),
)


def _format_sources(sources: list[dict]) -> str:
    lines = []
    for i, s in enumerate(sources, 1):
        content = s.get("scraped_content") or s.get("content", "")
        lines.append(f"[{i}] {s.get('title', 'Untitled')} — {s.get('url', '')}\n{content[:500]}")
    return "\n\n".join(lines)


async def run_writer_outline(state: ResearchState) -> dict:
    sources_text = _format_sources(state.get("ranked_sources", []))
    prompt = (
        f"You are writing an outline for a research report on: {state['query']}\n\n"
        f"Available sources:\n{sources_text}\n\n"
        f"Create a structured Markdown outline with H2 and H3 headings. "
        f"Include an Introduction and Conclusion. "
        f"Do NOT write the full content yet — outline structure only."
    )
    response = await _model.generate_content_async(prompt)
    outline = response.text.strip()
    logger.info("Writer: outline generated")
    return {"outline": outline, "status": "writer_outline"}


async def run_writer_final(state: ResearchState) -> dict:
    sources_text = _format_sources(state.get("ranked_sources", []))
    feedback = state.get("editor_feedback", "")
    feedback_section = f"\n\nEditor feedback to address:\n{feedback}" if feedback else ""

    prompt = (
        f"Write a complete research report on: {state['query']}\n\n"
        f"Follow this outline:\n{state.get('outline', '')}\n\n"
        f"Sources (cite as [1], [2], etc.):\n{sources_text}"
        f"{feedback_section}\n\n"
        f"Requirements:\n"
        f"- Follow the outline exactly\n"
        f"- Cite every factual claim with [n]\n"
        f"- Write an Introduction and Conclusion\n"
        f"- End with a '## References' section with clickable URLs\n"
        f"- Target 1500–2500 words"
    )
    response = await _model.generate_content_async(prompt)
    report = response.text.strip()
    logger.info("Writer: final report %d chars", len(report))
    return {"report": report, "status": "writer_final"}
