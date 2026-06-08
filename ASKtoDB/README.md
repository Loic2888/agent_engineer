# ASKtoDB — Natural Language to SQL Agent

Ask questions about your database in plain English or French. ASKtoDB translates them into SQL, executes the query, and returns a human-readable answer.

![Python](https://img.shields.io/badge/Python-3.12-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green) ![LangGraph](https://img.shields.io/badge/LangGraph-0.2-orange) ![React](https://img.shields.io/badge/React-18-61dafb) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ed)

---

## Features

- **Natural language interface** — ask questions in French or English, get plain-text answers
- **Universal DB support** — PostgreSQL, MySQL, SQLite, MSSQL, Oracle via a single connection URL
- **In-app DB connection** — enter or switch your database URL directly from the UI, no config file editing
- **Connection history** — previously used databases are saved in your browser for one-click reconnect
- **Read-only enforcement** — SQL generation is strictly limited to SELECT; any write keyword is blocked before execution
- **Auto-retry** — if the LLM or the DB returns a transient error, the agent retries automatically (up to 3 times)
- **SQL debug panel** — optionally display the generated SQL query alongside the answer

---

## Stack

| Layer | Technology |
|---|---|
| Orchestration | Python + LangGraph |
| LLM | Google Gemini 2.5 Flash |
| Database abstraction | SQLAlchemy (multi-dialect) |
| API | FastAPI |
| Frontend | React + TypeScript + Vite |
| Containerisation | Docker + Docker Compose |

---

## Project Structure

```
ASKtoDB/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── start.bat                  # Windows one-click launcher
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.py              # Settings loaded from .env
│   ├── main.py                # FastAPI entrypoint
│   ├── db/
│   │   └── connection.py      # SQLAlchemy engine, dynamic URL
│   └── agent/
│       ├── gemini_call.py     # Gemini wrapper with retry logic
│       ├── graph.py           # LangGraph pipeline
│       ├── state.py           # AgentState TypedDict
│       └── nodes/
│           ├── detect_db.py   # Dialect detection from URL
│           ├── fetch_schema.py# Schema introspection
│           ├── clarify.py     # Ambiguity detection
│           ├── generate_sql.py# SQL generation (Gemini)
│           ├── validate_sql.py# Read-only check + syntax validation
│           ├── execute_query.py# Query execution
│           ├── retry.py       # Retry counter
│           └── translate.py   # Results → natural language
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── App.tsx
        └── components/
            ├── ChatWindow.tsx      # Scrollable conversation history
            ├── QueryInput.tsx      # Text input + send
            ├── SqlDebugPanel.tsx   # Collapsible SQL display
            └── DbConnectPanel.tsx  # DB connection modal + history
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A [Gemini API key](https://aistudio.google.com) (free)

### Setup

**1. Clone the repository and enter the project folder**

```bash
git clone <repo-url>
cd ASKtoDB
```

**2. Create your `.env` file**

```bash
cp .env.example .env
```

Open `.env` and fill in your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**3. Start the application**

- **Windows:** double-click `start.bat`
- **Mac / Linux:**
  ```bash
  docker-compose up -d
  ```

**4. Open the app**

Go to [http://localhost:3005](http://localhost:3005)

**5. Connect your database**

A connection modal appears on first launch. Enter your database URL and click **Connect**.

---

## Database URL Formats

| Database | URL format |
|---|---|
| PostgreSQL | `postgresql://user:password@host:5432/dbname` |
| MySQL | `mysql+pymysql://user:password@host:3306/dbname` |
| SQLite | `sqlite:////absolute/path/to/file.db` |
| MSSQL | `mssql+pyodbc://user:password@host/dbname?driver=ODBC+Driver+17+for+SQL+Server` |

> **Tip — DB running in Docker?** Use `host.docker.internal` instead of `localhost` so ASKtoDB can reach it from inside its own container.
>
> Example: `postgresql://primo:primo_password@host.docker.internal:5433/primo_dev`

---

## Agent Pipeline

```
[START]
   ↓
detect_db_type    — reads DATABASE_URL prefix, identifies dialect
   ↓
fetch_schema      — introspects tables, columns, types, foreign keys
   ↓
clarify_if_needed — asks for clarification if the question is too vague
   ↓
generate_sql      — Gemini generates a SELECT query from question + schema
   ↓
validate_sql      — blocks forbidden keywords, validates syntax (sqlglot)
   ↓
execute_query     — runs the query via SQLAlchemy
   ↓  (on error → retry up to 3×)
translate_response — Gemini turns raw rows into a natural language answer
   ↓
[END]
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a question, receive an answer |
| `POST` | `/api/config/db` | Set the active database URL |
| `GET` | `/api/config/db` | Get current connection status |
| `GET` | `/api/schema` | Return the connected DB schema |
| `GET` | `/api/health` | Health check |

---

## Security

- **Read-only by design** — the following keywords are always blocked: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `REPLACE`, `MERGE`, `GRANT`, `REVOKE`, `EXEC`
- **Row limit** — results are capped at `MAX_ROWS_RETURNED` (default: 100) to prevent full table dumps
- **No credential storage** — the database URL is kept in container memory only; it is never written to a permanent file or sent to the LLM

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Fallback DB URL (used if none set via UI) |
| `GEMINI_API_KEY` | — | Google Gemini API key (required) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to use |
| `MAX_RETRIES` | `3` | Max LLM retry attempts on error |
| `MAX_ROWS_RETURNED` | `100` | Max rows returned per query |
| `SHOW_SQL_IN_UI` | `true` | Show generated SQL in the chat |
