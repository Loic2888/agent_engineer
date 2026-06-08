import logging
import uuid
import decimal
import datetime
from sqlalchemy import text
from backend.agent.state import AgentState
from backend.db.connection import get_engine
from backend.config import settings

logger = logging.getLogger(__name__)


def _serialize(value: object) -> object:
    if isinstance(value, (uuid.UUID, decimal.Decimal)):
        return str(value)
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.hex()
    return value


def execute_query(state: AgentState) -> dict:
    sql = state["sql_query"]
    try:
        with get_engine().connect() as conn:
            result = conn.execute(text(sql))
            columns = list(result.keys())
            rows = [
                {col: _serialize(val) for col, val in zip(columns, row)}
                for row in result.fetchmany(settings.max_rows_returned)
            ]
        logger.info("Query executed: %d row(s) returned", len(rows))
        return {"raw_results": rows, "validation_error": None}
    except Exception as exc:
        err = f"Erreur d'exécution DB : {exc}"
        logger.warning(err)
        return {"raw_results": None, "validation_error": err}
