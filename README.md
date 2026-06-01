# agent_engineer

A collection of AI agent projects built while learning agentic architecture — from simple single-agent tools to multi-agent pipelines.

Each project lives in its own folder with its own stack, README, and `CLAUDE.md` context file.

---

## Projects

| Project | Description | Stack | Status |
|---|---|---|---|
| [`deep-research`](./deep-research/) | Multi-agent pipeline that researches any topic and generates a structured Markdown report with citations | Python · FastAPI · LangGraph · Gemini · Tavily · React | 🚧 In progress |

---

## What is an AI agent?

An AI agent is a program that uses a language model not just to generate text, but to **plan, use tools, and take actions** toward a goal — often in a loop until the task is complete.

This repo explores different agent architectures:

- **Single agent** — one LLM with tools (search, code execution, file I/O)
- **Multi-agent pipeline** — specialized agents (planner, researcher, writer, editor) passing state through a graph
- **Agentic loop** — agents that evaluate their own output and iterate until a quality threshold is met

---

## Stack preferences

Most projects in this repo follow this stack unless noted otherwise:

- **LLM** — Google Gemini (via google-generativeai SDK)
- **Orchestration** — LangGraph (stateful multi-agent graphs)
- **Backend** — Python 3.12 + FastAPI + uvicorn
- **Frontend** — React 19 + Vite + TailwindCSS
- **Search** — Tavily API (primary) + SerpAPI (fallback)
- **Streaming** — Server-Sent Events (SSE)

---

## Repo structure

```
agent_engineer/
├── README.md
├── deep-research/          # Project 1
│   ├── CLAUDE.md
│   ├── backend/
│   └── frontend/
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
