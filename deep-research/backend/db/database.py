import os
import aiosqlite

DB_PATH = os.getenv("DB_PATH", "/data/research.db")


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS research (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                query       TEXT    NOT NULL,
                report      TEXT    NOT NULL,
                sources     TEXT    NOT NULL DEFAULT '[]',
                created_at  DATETIME DEFAULT (datetime('now'))
            )
        """)
        await db.commit()
