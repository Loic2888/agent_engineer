import json
import logging
from backend.agent.state import AgentState
from backend.agent.gemini_call import gemini_generate

logger = logging.getLogger(__name__)

_SYSTEM = """Tu es un assistant qui détermine si une question utilisateur est suffisamment claire pour être traduite en SQL.
Règles :
- Si la question mentionne une table ou colonne qui existe dans le schéma (même approximativement), réponds {"clear": true}.
- Ne demande une clarification QUE si la question est vraiment impossible à traduire en SQL avec le schéma fourni.
- En cas de doute, préfère {"clear": true} plutôt que de demander une clarification inutile.
Réponds uniquement par JSON : {"clear": true} ou {"clear": false, "message": "..."}."""


def clarify_if_needed(state: AgentState) -> dict:
    schema_summary = {
        table: [col["col"] for col in cols]
        for table, cols in state["schema"].items()
    }
    prompt = f"Question : {state['user_question']}\nSchéma disponible (tables et colonnes) : {schema_summary}"
    text = gemini_generate(prompt, _SYSTEM, response_mime_type="application/json")

    try:
        result = json.loads(text)
    except Exception:
        result = {"clear": True}

    if result.get("clear", True):
        logger.info("Question is clear, proceeding")
        return {"needs_clarification": False, "clarification_message": None}

    msg = result.get("message", "Pouvez-vous préciser votre question ?")
    logger.info("Clarification needed: %s", msg)
    return {"needs_clarification": True, "clarification_message": msg}
