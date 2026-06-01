import json
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

import google.generativeai as genai  # noqa: E402
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

from graph.pipeline import pipeline  # noqa: E402 — import after load_dotenv + genai.configure

app = FastAPI(title="Deep Research Agent")

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
        try:
            async for chunk in pipeline.astream(initial_state, stream_mode="updates"):
                for node_name, update in chunk.items():
                    # Exclude raw_sources — too large for the stream
                    safe = {k: v for k, v in update.items() if k != "raw_sources"}
                    yield f"data: {json.dumps({'step': node_name, 'data': safe})}\n\n"
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
