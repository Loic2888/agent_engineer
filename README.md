# agent_engineer

A collection of AI agent projects built while learning agentic architecture — from simple single-agent tools to multi-agent pipelines.

Each project lives in its own folder with its own stack, README, and `CLAUDE.md` context file.

---

## Projects

| Project | Description | Stack | Status |
|---|---|---|---|
| [`deep-research`](./deep-research/) | Multi-agent pipeline that researches any topic and generates a structured Markdown report with citations | Python · FastAPI · LangGraph · Gemini · Tavily · React | ✅ Done |
| [`invoice-processing`](./invoice-processing/) | Agentic pipeline that classifies documents and extracts invoice fields (issuer, amount, due date) into a database | Node.js · Express · Gemini · SQLite · Docker | ✅ Done |
| [`WEBtoPDF`](./WEBtoPDF/) | Multi-agent pipeline that converts PDF → HTML/CSS with visual validation loop (screenshot comparison via Gemini vision, iterates until ≥ 90% similarity) and HTML/CSS → PDF via Puppeteer | Node.js · Express · Puppeteer · pdfjs-dist · Gemini · SSE · Docker | 🔄 En cours |

---

## What is an AI agent?

An AI agent is a program that uses a language model not just to generate text, but to **plan, use tools, and take actions** toward a goal — often in a loop until the task is complete.

This repo explores different agent architectures:

- **Single agent** — one LLM with tools (search, code execution, file I/O)
- **Multi-agent pipeline** — specialized agents (planner, researcher, writer, editor) passing state through a graph
- **Agentic loop** — agents that evaluate their own output and iterate until a quality threshold is met

---

## Stack preferences

Each project picks the right tool for the job. Common choices across the repo:

- **LLM** — Google Gemini (`gemini-2.5-flash`) via the official SDK
- **Orchestration** — LangGraph (stateful multi-agent graphs) or custom Express pipelines
- **Backend** — Python 3.12 + FastAPI, or Node.js 20 + Express depending on the project
- **Frontend** — React 19 + Vite + TailwindCSS, or plain HTML/CSS/JS for lightweight UIs
- **Search** — Tavily API (primary) + SerpAPI (fallback)
- **Database** — SQLite for embedded storage, PostgreSQL for production workloads
- **Deployment** — Docker + Docker Compose for all projects; `launch.bat` for Windows one-click start

---

## Repo structure

```
agent_engineer/
├── README.md
├── deep-research/          # Project 1 — multi-agent research pipeline
│   ├── CLAUDE.md
│   ├── backend/
│   └── frontend/
├── invoice-processing/     # Project 2 — agentic invoice parser
│   ├── CLAUDE.md
│   ├── public/             # Web UI
│   ├── src/                # Express backend + agentic pipeline
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── launch.bat          # Windows one-click launcher
├── WEBtoPDF/               # Project 3 — PDF ↔ HTML/CSS multi-agent converter
│   ├── CLAUDE.md
│   ├── backend/            # Express + 8 agents + JobStore + SSE
│   ├── frontend/           # Vanilla UI with live agent log
│   ├── docker-compose.yml
│   └── start.bat           # Windows one-click launcher
└── ...                     # Future projects
```

---

## Getting started

Each project is self-contained. Navigate to a project folder and follow its own README.

```bash
git clone https://github.com/Loic2888/agent_engineer.git
cd agent_engineer/deep-research
# then follow deep-research/README.md
```

---

## Author

**Loïc** — Holberton School, Toulouse  
Fullstack & backend developer in training, specializing in agent AI and automatisation.

- [GitHub](https://github.com/Loic2888)
