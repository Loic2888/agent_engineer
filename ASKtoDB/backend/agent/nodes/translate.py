import json
import logging
from backend.agent.state import AgentState
from backend.agent.gemini_call import gemini_generate

logger = logging.getLogger(__name__)

_SYSTEM = """Tu es un assistant qui traduit des résultats de base de données en langage naturel.
Réponds en français de façon concise et précise. Si les résultats sont vides, dis-le clairement."""


def translate_response(state: AgentState) -> dict:
    rows = state.get("raw_results") or []
    results_str = json.dumps(rows[:50], ensure_ascii=False, indent=2)

    prompt = (
        f"Question originale : {state['user_question']}\n"
        f"Résultats ({len(rows)} lignes) :\n{results_str}"
    )

    answer = gemini_generate(prompt, _SYSTEM)
    logger.info("Response translated successfully")
    return {"natural_response": answer.strip(), "error_message": None}
