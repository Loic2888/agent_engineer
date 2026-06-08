import json
import logging
from backend.agent.state import AgentState
from backend.agent.gemini_call import gemini_generate
from backend.config import settings

logger = logging.getLogger(__name__)

_SYSTEM = """Tu es un expert SQL. Génère UNIQUEMENT la requête SQL sans explication ni markdown.
Règles strictes :
- Lecture seule (SELECT uniquement)
- Respecte le dialecte indiqué
- Utilise uniquement les tables et colonnes du schéma fourni
- Limite à {max_rows} lignes via LIMIT/TOP/ROWNUM selon le dialecte
- Retourne uniquement la requête SQL brute"""


def generate_sql(state: AgentState) -> dict:
    schema_str = json.dumps(state["schema"], ensure_ascii=False, indent=2)
    system = _SYSTEM.format(max_rows=settings.max_rows_returned)

    history_lines = ""
    if state.get("conversation_history"):
        history_lines = "\nHistorique :\n" + "\n".join(
            f"- {m['role']}: {m['content']}" for m in state["conversation_history"][-6:]
        )

    retry_context = ""
    if state.get("validation_error") and state.get("retry_count", 0) > 0:
        retry_context = f"\n\nLa requête précédente était incorrecte : {state['validation_error']}\nCorrige-la."

    prompt = (
        f"Dialecte SQL : {state['db_dialect']}\n"
        f"Schéma :\n{schema_str}\n"
        f"{history_lines}\n"
        f"Question : {state['user_question']}"
        f"{retry_context}"
    )

    sql = gemini_generate(prompt, system)
    sql = sql.strip().strip("```sql").strip("```").strip()
    logger.info("SQL generated (retry=%d): %s", state.get("retry_count", 0), sql[:120])
    return {"sql_query": sql, "validation_error": None}
