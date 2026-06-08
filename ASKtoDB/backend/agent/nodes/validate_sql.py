import logging
import re
from backend.agent.state import AgentState

logger = logging.getLogger(__name__)

FORBIDDEN_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "TRUNCATE", "REPLACE", "MERGE", "UPSERT", "GRANT", "REVOKE",
    "EXEC", "EXECUTE", "SP_", "XP_",
]

_FORBIDDEN_RE = re.compile(
    r"\b(" + "|".join(re.escape(kw) for kw in FORBIDDEN_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


def validate_sql(state: AgentState) -> dict:
    sql = state.get("sql_query", "")

    if not sql:
        return {"validation_error": "Aucune requête SQL générée."}

    match = _FORBIDDEN_RE.search(sql)
    if match:
        err = f"Requête refusée : mot-clé interdit détecté '{match.group()}'."
        logger.warning(err)
        return {"validation_error": err}

    try:
        import sqlglot
        dialect = state.get("db_dialect", "")
        sqlglot_dialect = {
            "postgresql": "postgres",
            "mysql": "mysql",
            "sqlite": "sqlite",
            "mssql": "tsql",
            "oracle": "oracle",
        }.get(dialect, None)
        sqlglot.parse_one(sql, dialect=sqlglot_dialect)
    except Exception as exc:
        err = f"Erreur de syntaxe SQL : {exc}"
        logger.warning(err)
        return {"validation_error": err}

    logger.info("SQL validated successfully")
    return {"validation_error": None}
