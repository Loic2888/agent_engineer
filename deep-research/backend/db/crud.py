import json
import re
import aiosqlite
from .database import DB_PATH

_STOP_WORDS = {
    'what', 'is', 'are', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to',
    'for', 'with', 'by', 'from', 'as', 'how', 'why', 'when', 'where',
    'who', 'which', 'that', 'this', 'these', 'those', 'and', 'or', 'but',
    'not', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will',
    'have', 'has', 'had', 'been', 'be', 'being', 'it', 'its', 'about',
    'me', 'my', 'i', 'you', 'we', 'they', 'their', 'our', 'some', 'any',
}


def _tokenize(text: str) -> set[str]:
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    return {w for w in text.split() if w not in _STOP_WORDS and len(w) > 1}


def _similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    jaccard = inter / len(a | b)
    contain_a = inter / len(a)
    contain_b = inter / len(b)
    return max(jaccard, contain_a, contain_b)


async def save_research(query: str, report: str, sources: list[dict]) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO research (query, report, sources) VALUES (?, ?, ?)",
            (query, report, json.dumps(sources, ensure_ascii=False)),
        )
        await db.commit()
        return cursor.lastrowid  # type: ignore[return-value]


async def list_research() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, query, created_at FROM research ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_research(research_id: int) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, query, report, sources, created_at FROM research WHERE id = ?",
            (research_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        result = dict(row)
        result["sources"] = json.loads(result["sources"])
        return result


async def find_similar(query: str, threshold: float = 0.5) -> list[dict]:
    query_tokens = _tokenize(query)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, query, created_at FROM research ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()

    results = []
    for row in rows:
        item = dict(row)
        score = _similarity(query_tokens, _tokenize(item["query"]))
        if score >= threshold:
            item["similarity"] = round(score, 2)
            results.append(item)

    return sorted(results, key=lambda x: x["similarity"], reverse=True)[:5]


async def delete_research(research_id: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM research WHERE id = ?", (research_id,)
        )
        await db.commit()
        return cursor.rowcount > 0
