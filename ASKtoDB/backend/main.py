import time
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.agent.graph import agent_graph
from backend.db.connection import check_connection, get_engine, set_database_url, get_current_url
from backend.config import settings
from sqlalchemy import inspect

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="ASKtoDB — NL-to-SQL Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    answer: str
    sql_query: str | None = None
    execution_time_ms: int


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    start = time.monotonic()
    initial_state = {
        "user_question": req.question,
        "conversation_history": req.history,
        "db_dialect": "",
        "schema": {},
        "sql_query": None,
        "validation_error": None,
        "raw_results": None,
        "retry_count": 0,
        "natural_response": "",
        "needs_clarification": False,
        "clarification_message": None,
        "error_message": None,
    }

    try:
        result = agent_graph.invoke(initial_state)
    except Exception as exc:
        logger.error("Agent error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    elapsed_ms = int((time.monotonic() - start) * 1000)
    sql = result.get("sql_query") if settings.show_sql_in_ui else None

    return ChatResponse(
        answer=result.get("natural_response", ""),
        sql_query=sql,
        execution_time_ms=elapsed_ms,
    )


@app.get("/api/schema")
async def get_schema():
    try:
        inspector = inspect(get_engine())
        tables = {}
        for table in inspector.get_table_names():
            tables[table] = [col["name"] for col in inspector.get_columns(table)]
        return {"tables": tables}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class DbConfigRequest(BaseModel):
    database_url: str


@app.post("/api/config/db")
async def set_db(req: DbConfigRequest):
    set_database_url(req.database_url)
    ok = check_connection()
    if not ok:
        return {"success": False, "message": "Connexion impossible. Vérifiez l'URL et que la base est accessible."}
    try:
        inspector = inspect(get_engine())
        tables = inspector.get_table_names()
    except Exception:
        tables = []
    return {"success": True, "message": f"Connecté — {len(tables)} table(s) détectée(s).", "tables": tables}


@app.get("/api/config/db")
async def get_db_config():
    url = get_current_url()
    # mask password in response
    import re
    masked = re.sub(r"(:)[^:@]+(@)", r"\1***\2", url)
    connected = check_connection()
    return {"url_masked": masked, "connected": connected}


@app.get("/api/health")
async def health():
    db_ok = check_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "agent": "ready",
    }
