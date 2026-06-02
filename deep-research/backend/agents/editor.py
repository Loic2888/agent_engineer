import logging
import google.generativeai as genai
from graph.state import ResearchState

logger = logging.getLogger(__name__)
<<<<<<< HEAD
_model = genai.GenerativeModel("gemini-2.0-flash")
=======
_model = genai.GenerativeModel("gemini-2.5-flash")
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d


async def run_editor(state: ResearchState) -> dict:
    sub_q_text = "\n".join(f"- {q}" for q in state.get("sub_questions", []))
    source_count = len(state.get("ranked_sources", []))

    prompt = (
        f"Review this research outline for completeness.\n\n"
        f"Original question: {state['query']}\n\n"
        f"Sub-questions to cover:\n{sub_q_text}\n\n"
        f"Sources available: {source_count}\n\n"
        f"Outline:\n{state.get('outline', '')}\n\n"
        f"Evaluate:\n"
        f"1. Does the outline cover all sub-questions?\n"
        f"2. Are there enough sources?\n"
        f"3. Is the structure coherent?\n\n"
        f"Respond with:\n"
        f"VERDICT: APPROVED or NEEDS_MORE_RESEARCH\n"
        f"FEEDBACK: <specific feedback>"
    )
    response = await _model.generate_content_async(prompt)
    text = response.text.strip()
    needs_more = "NEEDS_MORE_RESEARCH" in text

    feedback = ""
    if "FEEDBACK:" in text:
        feedback = text.split("FEEDBACK:", 1)[1].strip()

    logger.info("Editor: %s (iteration=%d)", "NEEDS_MORE_RESEARCH" if needs_more else "APPROVED", state.get("iteration", 0))
    return {
        "editor_feedback": feedback,
        "needs_more_research": needs_more,
        "status": "editor",
    }
