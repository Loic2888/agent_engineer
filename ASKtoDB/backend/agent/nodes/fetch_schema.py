import logging
from sqlalchemy import inspect
from backend.agent.state import AgentState
from backend.db.connection import get_engine

logger = logging.getLogger(__name__)


def fetch_schema(state: AgentState) -> dict:
    engine = get_engine()
    inspector = inspect(engine)
    schema: dict = {}

    for table_name in inspector.get_table_names():
        columns = []
        pk_cols = set(inspector.get_pk_constraint(table_name).get("constrained_columns", []))
        fk_map = {
            fk["constrained_columns"][0]: fk["referred_table"]
            for fk in inspector.get_foreign_keys(table_name)
            if fk["constrained_columns"]
        }
        for col in inspector.get_columns(table_name):
            columns.append({
                "col": col["name"],
                "type": str(col["type"]),
                "nullable": col.get("nullable", True),
                "pk": col["name"] in pk_cols,
                "fk": fk_map.get(col["name"]),
            })
        schema[table_name] = columns

    logger.info("Schema fetched: %d table(s)", len(schema))
    return {"schema": schema}
