import logging
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from backend.config import settings

logger = logging.getLogger(__name__)

_engine: Engine | None = None
_URL_FILE = Path("/tmp/.asktodb_url")


def set_database_url(url: str) -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None
    _URL_FILE.write_text(url)
    logger.info("Database URL updated and persisted")


def get_current_url() -> str:
    if _URL_FILE.exists():
        url = _URL_FILE.read_text().strip()
        if url:
            return url
    return settings.database_url


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        url = get_current_url()
        _engine = create_engine(url, pool_pre_ping=True, pool_recycle=3600)
        logger.info("SQLAlchemy engine created for: %s", url.split("@")[-1])
    return _engine


def check_connection() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("DB connection check failed: %s", exc)
        return False
