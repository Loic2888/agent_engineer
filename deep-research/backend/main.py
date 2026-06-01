import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

import google.generativeai as genai  # noqa: E402
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

from graph.pipeline import pipeline          # noqa: E402
from db.database import init_db             # noqa: E402
from db.crud import (                       # noqa: E402
    save_research,
    list_research,
    get_research,
    delete_research,
    find_similar,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Database initialised")
    yield


app = FastAPI(title="Deep Research Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    query: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/research")
async def run_research(payload: ResearchRequest):
    initial_state = {
        "query": payload.query,
        "sub_questions": [],
        "raw_sources": [],
        "ranked_sources": [],
        "outline": "",
        "editor_feedback": "",
        "needs_more_research": False,
        "report": "",
        "iteration": 0,
        "status": "starting",
    }

    async def event_stream():
        final_report = ""
        final_sources: list[dict] = []

        try:
            async for chunk in pipeline.astream(initial_state, stream_mode="updates"):
                for node_name, update in chunk.items():
                    if "ranked_sources" in update:
                        final_sources = update["ranked_sources"]
                    if update.get("report"):
                        final_report = update["report"]

                    safe = {k: v for k, v in update.items() if k != "raw_sources"}
                    yield f"data: {json.dumps({'step': node_name, 'data': safe})}\n\n"

            if final_report:
                research_id = await save_research(payload.query, final_report, final_sources)
                yield f"data: {json.dumps({'step': 'saved', 'data': {'id': research_id}})}\n\n"

        except Exception as e:
            logger.error("Pipeline error: %s", e)
            yield f"data: {json.dumps({'step': 'error', 'data': {'error': str(e)}})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class SimilarRequest(BaseModel):
    query: str


@app.post("/history/similar")
async def similar_research(payload: SimilarRequest):
    return await find_similar(payload.query)


@app.get("/history")
async def get_history():
    return await list_research()


@app.get("/history/{research_id}")
async def get_history_item(research_id: int):
    item = await get_research(research_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@app.delete("/history/{research_id}")
async def delete_history_item(research_id: int):
    deleted = await delete_research(research_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}
