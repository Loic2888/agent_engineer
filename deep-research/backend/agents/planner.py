import json
import logging
import re
import google.generativeai as genai
from graph.state import ResearchState

logger = logging.getLogger(__name__)
_model = genai.GenerativeModel("gemini-2.5-flash")

_PROMPT = """Decompose this research question into 3 to 5 precise, complementary sub-questions \
that together cover the topic thoroughly.

Question: {query}

Return ONLY a JSON array of strings, no explanation:
["sub-question 1", "sub-question 2", ...]"""


async def run_planner(state: ResearchState) -> dict:
    response = await _model.generate_content_async(_PROMPT.format(query=state["query"]))
    text = response.text.strip()
    match = re.search(r"\[.*\]", text, re.DOTALL)
    sub_questions: list[str] = json.loads(match.group()) if match else [state["query"]]
    logger.info("Planner: %d sub-questions", len(sub_questions))
    return {"sub_questions": sub_questions, "status": "planner"}
