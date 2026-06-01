# deep-research

A multi-agent AI pipeline that takes any research question and returns a structured, cited Markdown report — automatically.

Built as the first project of [`agent_engineer`](../README.md).

---

## Demo

```
User: "What are the best strategies to reduce churn in a B2B SaaS product?"

→ Planner     Decomposing into 4 sub-questions...
→ Researcher  Collecting sources from Tavily + SerpAPI...
→ Synthesizer Ranking and deduplicating 23 sources...
→ Writer      Generating outline...
→ Editor      Reviewing coverage... OK
→ Writer      Writing final report...

✓ Report ready — 1 847 words, 12 sources cited
✓ Saved to history
```

---

## Features

- **Multi-agent pipeline** — 5 specialized agents orchestrated by LangGraph
- **Live progress** — each pipeline step streams to the UI via SSE
- **Research history** — every report is saved to a local SQLite database and survives restarts
- **Similarity detection** — before running, the app checks for existing similar searches and lets you choose to reuse or refresh
- **One-click launch** — double-click `launch.bat` to build, start, and open the browser

---

## Architecture

```
[START]
   │
   ▼
[planner]           Breaks the query into 3–5 focused sub-questions
   │
   ▼
[researcher]        Searches Tavily + SerpAPI, scrapes top URLs
   │
   ▼
[synthesizer]       Deduplicates, ranks by relevance and recency
   │
   ▼
[writer — outline]  Produces a structured Markdown outline
   │
   ▼
[editor]            Reviews coverage and coherence
   │         ╲
   │          └──→ if insufficient (max 2 iterations): back to [researcher]
   ▼
[writer — final]    Writes the full Markdown report with inline citations
   │
   ▼
[END — saved to SQLite]
```

Each agent is a LangGraph node that reads from and writes to a shared `ResearchState`. The frontend receives live step updates via Server-Sent Events (SSE).

---

## Tech stack

| Layer | Technology |
|---|---|
| LLM | Google Gemini (`gemini-2.5-flash`) |
| Agent orchestration | LangGraph |
| Backend | Python 3.12 + FastAPI + uvicorn |
| Database | SQLite via aiosqlite |
| Search | Tavily API (primary) + SerpAPI (fallback) |
| Scraping | httpx + BeautifulSoup4 |
| Streaming | Server-Sent Events (SSE) |
| Frontend | React 19 + Vite + TailwindCSS |
| Markdown rendering | react-markdown + remark-gfm |

---

## Project structure

```
deep-research/
├── setup.py                    # automation script — build, start, open browser
├── launch.bat                  # Windows double-click wrapper → calls setup.py
├── docker-compose.yml
│
├── backend/
│   ├── main.py                 # FastAPI entry point + SSE endpoint + history API
│   ├── requirements.txt
│   ├── agents/
│   │   ├── planner.py
│   │   ├── researcher.py
│   │   ├── synthesizer.py
│   │   ├── writer.py
│   │   └── editor.py
│   ├── tools/
│   │   ├── tavily_search.py
│   │   ├── serp_search.py
│   │   └── scraper.py
│   ├── graph/
│   │   ├── state.py            # ResearchState TypedDict
│   │   └── pipeline.py         # LangGraph graph definition
│   ├── db/
│   │   ├── database.py         # SQLite init
│   │   └── crud.py             # save / list / get / delete / find_similar
│   └── utils/
│       └── markdown.py
│
└── frontend/
    ├── nginx.conf              # SPA + SSE proxy + /history proxy
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── SearchBar.tsx
        │   ├── ProgressSteps.tsx
        │   ├── ReportViewer.tsx
        │   ├── SourceCard.tsx
        │   ├── HistoryPanel.tsx    # left sidebar — past searches
        │   └── SimilarityModal.tsx # prompt when similar search found
        └── lib/
            └── api.ts
```

---

## Getting started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- API keys: [Google Gemini](https://aistudio.google.com/apikey), [Tavily](https://tavily.com), [SerpAPI](https://serpapi.com)

### Option A — Double-click launch (Windows, recommended)

```
1. Copy .env.example → .env and fill in your API keys
2. Double-click launch.bat
```

`launch.bat` will:
- Check Docker is running
- Build the containers (`docker compose up --build`)
- Wait for backend + frontend to be healthy
- Open [http://localhost](http://localhost) in your browser
- Stream logs to the terminal

> Press `Ctrl+C` to stop the log stream — containers keep running.
> To stop everything: `docker compose down`

### Option B — Terminal

```bash
cp .env.example .env
# fill in your API keys

docker compose up --build
```

Open [http://localhost](http://localhost).

### Option C — Local development (no Docker)

Requires Python 3.12+ and Node.js 20+.

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Environment variables

```bash
# .env.example

GEMINI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
SERPAPI_API_KEY=...

# Set automatically by Docker Compose — do not change
DB_PATH=/data/research.db

# Local dev only
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173
```

---

## How it works

### 1. Similarity check
Before running the pipeline, the app calls `POST /history/similar`. A lightweight algorithm (no LLM, < 50 ms) computes word-overlap scores against all past queries. If a match is found (score ≥ 50%), a modal offers to load the existing report or run a fresh search.

### 2. Planner
Receives the raw user query and instructs Gemini to decompose it into 3–5 precise, complementary sub-questions. This prevents broad, unfocused searches downstream.

### 3. Researcher
For each sub-question, queries Tavily first (optimized for RAG — returns clean content, not just links). Falls back to SerpAPI if Tavily returns insufficient results. Scrapes the top 3 URLs per sub-question with httpx + BeautifulSoup4.

### 4. Synthesizer
Deduplicates sources by URL, ranks them by Tavily relevance score and publication date, and caps the list at 15 sources to stay within LLM context limits.

### 5. Writer (outline)
Generates a structured Markdown outline (H2/H3 headings) based on the ranked sources. Does not write content yet — only structure.

### 6. Editor
Reviews the outline against the original sub-questions. Checks for coverage gaps, missing citations, and logical coherence. If satisfied, passes to the final writer. If not, sends the researcher back for another iteration (max 2 loops).

### 7. Writer (final)
Writes the complete Markdown report following the approved outline. Every factual claim is cited with `[1]`, `[2]`… A `## References` section with clickable links is appended automatically.

### 8. Save
The finished report and its sources are saved to SQLite. An SSE `saved` event triggers a history refresh in the sidebar.

---

## API

### `POST /research`
Starts a research pipeline and streams progress via SSE.

**Request body:** `{ "query": "Your research question" }`

**SSE events:**
```
data: {"step": "planner",       "data": {...}}
data: {"step": "researcher",    "data": {...}}
data: {"step": "synthesizer",   "data": {"ranked_sources": [...]}}
data: {"step": "writer_outline","data": {...}}
data: {"step": "editor",        "data": {...}}
data: {"step": "writer_final",  "data": {"report": "# Report\n\n..."}}
data: {"step": "saved",         "data": {"id": 42}}
```

### `POST /history/similar`
Returns past searches similar to the given query (score ≥ 0.5).

**Request body:** `{ "query": "..." }`

### `GET /history`
Returns the list of all past searches (id, query, created_at).

### `GET /history/{id}`
Returns a full research item (report + sources).

### `DELETE /history/{id}`
Deletes a research item.

---

## Data persistence

Research history is stored in a SQLite database inside a **named Docker volume** (`research_data`). The volume survives container stops, rebuilds, and `docker compose down`. Only `docker compose down -v` deletes it.

---

## Known limitations

- Max 2 researcher iterations per query (prevents infinite loops)
- Sources are capped at 15 to avoid LLM context overflow
- Scraping may fail on JavaScript-heavy pages (no headless browser)
- Similarity detection is keyword-based — it won't catch paraphrased queries with no word overlap

---

## Roadmap

- [ ] Export report as PDF
- [ ] Source credibility scoring
- [ ] Support for file uploads as additional context
- [x] Docker Compose setup
- [x] One-click launcher (`launch.bat` / `setup.py`)
- [x] Research history (SQLite)
- [x] Similarity detection before search

---

## Author

**Loïc** — [GitHub](https://github.com/Loic2888)
