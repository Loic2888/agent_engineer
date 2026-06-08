import logging
from backend.agent.state import AgentState
from backend.config import settings

logger = logging.getLogger(__name__)

_DIALECT_MAP = {
    "postgresql": "postgresql",
    "postgres": "postgresql",
    "mysql": "mysql",
    "sqlite": "sqlite",
    "mssql": "mssql",
    "oracle": "oracle",
}


def detect_db_type(state: AgentState) -> dict:
    url = settings.database_url.lower()
    dialect = "unknown"
    for prefix, name in _DIALECT_MAP.items():
        if url.startswith(prefix):
            dialect = name
            break
    logger.info("Detected DB dialect: %s", dialect)
    return {"db_dialect": dialect}
