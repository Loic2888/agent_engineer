# deep-research

A multi-agent AI pipeline that takes any research question and returns a structured, cited Markdown report — automatically.

Built as the first project of [`agent_engineer`](../README.md).

---

## Demo

```
User: "What are the best strategies to reduce churn in a B2B SaaS product?"

→ Planner    Decomposing into 4 sub-questions...
→ Researcher Collecting sources from Tavily + SerpAPI...
→ Synthesizer Ranking and deduplicating 23 sources...
→ Writer     Generating outline...
→ Editor     Reviewing coverage... OK
→ Writer     Writing final report...

✓ Report ready — 1 847 words, 12 sources cited
```

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
[END]
```

Each agent is a LangGraph node that reads from and writes to a shared `ResearchState`. The frontend receives live step updates via Server-Sent Events (SSE).

---

## Tech stack

| Layer | Technology |
|---|---|
| LLM | Google Gemini (`gemini-2.0-flash`) |
| Agent orchestration | LangGraph |
| Backend | Python 3.12 + FastAPI + uvicorn |
| Search | Tavily API (primary) + SerpAPI (fallback) |
| Scraping | httpx + BeautifulSoup4 |
| Streaming | Server-Sent Events (SSE) |
| Frontend | React 19 + Vite + TailwindCSS |
| Markdown rendering | react-markdown + remark-gfm |

---

## Project structure

```
deep-research/
├── CLAUDE.md                   # Context file for Claude Code
├── .env.example
├── .gitignore
├── docker-compose.yml          # Orchestration backend + frontend
│
├── backend/
│   ├── Dockerfile
│   ├── main.py                 # FastAPI entry point + SSE endpoint
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
│   └── utils/
│       └── markdown.py
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf              # Nginx: SPA + SSE proxy to backend
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── SearchBar.tsx
        │   ├── ProgressSteps.tsx
        │   ├── ReportViewer.tsx
        │   └── SourceCard.tsx
        └── lib/
            └── api.ts
```

---

## Getting started

### Prerequisites

- API keys: Google Gemini, Tavily, SerpAPI

### Option A — Docker (recommended)

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
git clone https://github.com/Loic2888/agent_engineer.git
cd agent_engineer/deep-research

cp .env.example .env
# Fill in your API keys in .env

docker compose up --build
```

Open [http://localhost](http://localhost).

> The frontend container (nginx) proxies `/research` requests to the backend container, so SSE streaming works out of the box with no extra config.

---

### Option B — Local development

Requires Python 3.12+ and Node.js 20+.

#### 1. Clone and configure

```bash
git clone https://github.com/Loic2888/agent_engineer.git
cd agent_engineer/deep-research

cp .env.example .env
# Fill in your API keys in .env
```

#### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 3. Frontend

```bash
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

# Local dev only (Docker Compose overrides these automatically)
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173
```

---

## How it works

### 1. Planner
Receives the raw user query and instructs Claude to decompose it into 3–5 precise, complementary sub-questions. This prevents broad, unfocused searches downstream.

### 2. Researcher
For each sub-question, queries Tavily first (optimized for RAG — returns clean content, not just links). Falls back to SerpAPI if Tavily returns insufficient results. Scrapes the top 3 URLs per sub-question with httpx + BeautifulSoup4.

### 3. Synthesizer
Deduplicates sources by URL, ranks them by Tavily relevance score and publication date, and caps the list at 15 sources to stay within LLM context limits.

### 4. Writer (outline)
Generates a structured Markdown outline (H2/H3 headings) based on the ranked sources. Does not write content yet — only structure.

### 5. Editor
Reviews the outline against the original sub-questions. Checks for coverage gaps, missing citations, and logical coherence. If satisfied, passes to the final writer. If not, sends the researcher back for another iteration (max 2 loops).

### 6. Writer (final)
Writes the complete Markdown report following the approved outline. Every factual claim is cited with `[1]`, `[2]`… A `## References` section with clickable links is appended automatically.

---

## API

### `POST /research`

Starts a research pipeline and streams progress via SSE.

**Request body:**
```json
{ "query": "Your research question here" }
```

**SSE event stream:**
```
data: {"step": "planner", "data": {...}}
data: {"step": "researcher", "data": {...}}
data: {"step": "synthesizer", "data": {...}}
data: {"step": "writer_outline", "data": {...}}
data: {"step": "editor", "data": {...}}
data: {"step": "writer_final", "data": {"report": "# Report\n\n..."}}
```

---

## Known limitations

- Max 2 researcher iterations per query (prevents infinite loops)
- Sources are capped at 15 to avoid LLM context overflow
- Scraping may fail on JavaScript-heavy pages (no headless browser)
- Not optimized for very long queries (500+ word prompts)

---

## Roadmap

- [ ] Export report as PDF
- [ ] Source credibility scoring
- [ ] Query history (SQLite)
- [ ] Support for file uploads as additional context
- [x] Docker Compose setup

---

## Author

**Loïc** — [GitHub](https://github.com/Loic2888)
