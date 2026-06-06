# 📧 Email Agent — Automated Customer Email Responses

An **agentic** application that reads customer emails from a Gmail inbox, classifies
them, extracts intent, generates a tailored reply (always using formal French
**vouvoiement**), and submits the draft for **human validation** before sending.

Everything runs in Docker and exposes a web UI: unread emails are processed
**automatically** on open, and you can approve, edit, regenerate or delete each
reply in one click.

---

## ✨ Features

- **Automatic sequential processing**: on open, every unread email goes through the
  pipeline, one after another, with no manual action.
- **Classification (triage)**: `rdv` · `reclamation` · `info` · `spam` · `hors_scope`.
  Spam and out-of-scope emails are short-circuited (no reply generated).
- **Contact memory** (ChromaDB): sender recognition, interaction history,
  "new contact" badge.
- **Structured extraction**: intent, entities (date, service, amount…), missing
  information. A date without a year is mapped to the current year automatically.
- **Reply generation** (Gemini) with adapted tone (formal / semi-formal) and
  **systematic vouvoiement**.
- **Human review**: side-by-side received email / generated reply, manual editing,
  regeneration with a free-text instruction, then send.
- **Deletion**: move an email to the Gmail trash (recoverable for 30 days), handy
  for clearing out spam.

---

## 🧠 Agentic framework

Orchestration is built on **[LangGraph](https://langchain-ai.github.io/langgraph/)**:
a state graph where each step is a **node** — a pure function
`(state: AgentState) -> AgentState`. The state (`AgentState`) flows from node to node,
accumulating information.

### The pipeline

```
            ┌─────────────┐
            │ fetch_email │  [1] Fetch + convert to plain text (Gmail API)
            └──────┬──────┘
                   ▼
            ┌─────────────┐
            │   triage    │  [0] Classification: type + priority + requires_human
            └──────┬──────┘
                   ▼
            ◇ spam / hors_scope ? ──── yes ──▶ END (no reply generated)
                   │ no
                   ▼
            ┌─────────────┐
            │  identify   │  [2] Sender identification (ChromaDB memory)
            └──────┬──────┘     + add if unknown
                   ▼
            ┌─────────────┐
            │   extract   │  [3] Intent + entities + missing info + tone
            └──────┬──────┘     (today's date is injected → year handling)
                   ▼
            ┌─────────────┐
            │  generate   │  [4-5] Tone selection + reply generation (Gemini)
            └──────┬──────┘
                   ▼
                  END ──▶ draft ready for human review
```

### After human validation (outside the graph)

When you approve a draft in the UI, the email is sent and the **`followup`** node is
called directly (step 7):

- updates the contact's **memory** (last contact, history);
- creates a **follow-up task** based on the type (RDV reminder at 48 h, complaint
  follow-up at 72 h).

> The `followup` node is intentionally **not** wired into the graph: it must only run
> **after** human approval, not in the automatic flow.

### The state model (`AgentState`)

Defined in [`backend/agent/state.py`](backend/agent/state.py), it groups the source
email fields, classification, contact, extraction, generation, review and post-send
data. Each node reads and enriches this typed dictionary.

### Prompts

All prompts are **externalized** in [`backend/agent/prompts/`](backend/agent/prompts/)
(`triage.txt`, `extract.txt`, `generate.txt`, `tone.txt`) — never hardcoded. Variable
substitution uses `render_prompt()` (not `str.format()`) so it doesn't break on the
curly braces of the JSON examples embedded in the prompts.

---

## 🛠️ Tech stack

| Component         | Technology                               |
|-------------------|------------------------------------------|
| Orchestration     | Python + LangGraph                       |
| LLM               | Google Gemini (`gemini-2.5-flash`)       |
| Memory            | ChromaDB + `all-MiniLM-L6-v2` embeddings |
| Backend / API     | FastAPI + Uvicorn                        |
| Frontend          | React + TypeScript + Vite                |
| Client / API state| Zustand + React Query (`@tanstack`)      |
| Email             | Gmail API (OAuth2)                       |
| Containerization  | Docker + Docker Compose                  |
| Windows launcher  | `start.bat`                              |

---

## 📋 Prerequisites

1. **Docker Desktop** installed and running.
2. A **Google Gemini API key** → [Google AI Studio](https://aistudio.google.com/app/apikey).
3. A **Gmail OAuth2 client** of type *Desktop app* ("installed"), downloaded as
   `gmail_credentials.json` from the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
4. Your Gmail address added as a **test user** in the OAuth consent screen (while the
   Google app is in "testing" mode).

---

## 🚀 Setup & launch

### 1. Configure environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env
```

```env
# LLM
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash

# Gmail
GMAIL_USER=your@gmail.com

# Ports (change if already in use on your machine)
BACKEND_PORT=8002
FRONTEND_PORT=3004
LOG_LEVEL=INFO
```

> The frontend automatically derives its API URL from `BACKEND_PORT`.

### 2. Add the Gmail credentials

Place your OAuth file in `credentials/`:

```
credentials/gmail_credentials.json
```

### 3. Launch the application

**Windows**: double-click `start.bat`.

**Linux / macOS / WSL**:

```bash
docker compose up --build
```

### 4. Authorize Gmail (one-time step)

The container has no browser: OAuth authorization is done **once** through a dedicated
script. From the project folder:

```bash
docker compose run --rm -p 8765:8765 backend python -m backend.gmail.authorize
```

1. The script prints a **URL** → open it in your browser.
2. Sign in with the `GMAIL_USER` account and grant access (read, send, and
   manage/trash emails).
3. `token.json` is created in `credentials/` (persistent, then reused without a
   browser thanks to the refresh token).
4. Restart the application.

> In "testing" mode, Google shows "App not verified" → **Advanced** →
> **Go to … (unsafe)** to continue.

### 5. Open the interface

- **UI**: http://localhost:3004
- **API**: http://localhost:8002
- **API docs (Swagger)**: http://localhost:8002/docs

---

## 🖱️ Usage

1. **Open the UI**: unread emails load and are **processed automatically**, one after
   another (a "Automatic processing in progress" banner is shown).
2. Each card shows a **type badge** once processed
   (Spam, Rendez-vous, Réclamation, Information, Hors scope).
3. **View the draft** (for `rdv` / `reclamation` / `info` emails) opens the **review**:
   - side-by-side comparison of *received email* / *generated reply*;
   - **edit** the reply manually;
   - **regenerate** with an instruction ("more formal", "add a closing line"…);
   - **Approve and send**: the email goes out, the contact is updated, and a follow-up
     task is created when relevant.
4. **Delete**: moves the email to the Gmail trash (recoverable for 30 days) — ideal for
   spam.

---

## 🔌 API endpoints

| Method   | Route                       | Description                               |
|----------|-----------------------------|-------------------------------------------|
| `GET`    | `/emails/inbox`             | List unread emails (+ type if processed)  |
| `POST`   | `/emails/{id}/process`      | Run the agentic pipeline on an email      |
| `GET`    | `/emails/{id}/draft`        | Get the generated draft                   |
| `POST`   | `/emails/{id}/approve`      | Validate and send the draft               |
| `POST`   | `/emails/{id}/regenerate`   | Regenerate the reply with an instruction  |
| `DELETE` | `/emails/{id}`              | Move the email to the Gmail trash         |
| `GET`    | `/contacts`                 | List contacts in memory                   |
| `GET`    | `/contacts/{id}`            | Contact details + history                 |
| `GET`    | `/health`                   | Service status                            |

---

## 📁 Project structure

```
mail-response/
├── docker-compose.yml
├── start.bat                       # Windows launcher (double-click)
├── .env / .env.example
├── credentials/                    # gmail_credentials.json + token.json (git-ignored)
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                     # FastAPI API (endpoints)
│   └── agent/
│       ├── state.py                # AgentState (TypedDict)
│       ├── pipeline.py             # LangGraph graph
│       ├── prompt_utils.py         # render_prompt()
│       ├── nodes/                  # triage, fetch_email, identify, extract, generate, followup
│       └── prompts/                # triage.txt, extract.txt, generate.txt, tone.txt
│   ├── gmail/                      # auth (OAuth2), reader, sender, authorize
│   ├── memory/                     # chroma_client, contacts (ChromaDB CRUD)
│   └── models/                     # Pydantic: email_model, contact, intent
│
└── frontend/
    ├── Dockerfile
    └── src/
        ├── App.tsx
        ├── api.ts                  # Typed HTTP client
        ├── pages/                  # Inbox, Review
        └── components/             # EmailCard, DiffViewer, ContactBadge
```

---

## 🔐 Security

- **No hardcoded secrets**: the Gemini key is read from the environment, OAuth
  credentials from `credentials/`.
- `.env`, `gmail_credentials.json` and `token.json` are **excluded from Git**
  (`.gitignore`).
- `token.json` (with trash access via the `gmail.modify` scope) stays local, mounted as
  a volume outside the source code.
- ChromaDB is not exposed outside the Docker network (its port is opened for debugging
  only). **In production: remove the ChromaDB port mapping.**

---

## 🩹 Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| "Impossible de charger la boîte de réception" | `token.json` missing/invalid → re-run the authorization script (step 4). |
| `Error 403: access_denied` (Google) | Add your address under **Test users** in the OAuth consent screen, on the correct project. |
| `could not locate runnable browser` | Authorization can't happen inside the container: use the `authorize` script (step 4). |
| `Bind for 0.0.0.0:XXXX failed: port is already allocated` | Port already used by another service → change `BACKEND_PORT` / `FRONTEND_PORT` in `.env`. |
| `ModuleNotFoundError: No module named 'backend'` | Rebuild the image: `docker compose build backend`. |
| Backend/frontend changes not picked up | Code is baked into the image (no hot-reload) → `docker compose build <service>` then `up -d`. |

> **WSL / Windows note**: the source-code bind mount was intentionally removed, because
> when launched from Windows over a WSL path (`\\wsl.localhost\…`), Docker Desktop
> mangles the path and hides the code. The code therefore always comes from the image —
> identical behavior on Windows and WSL, at the cost of a `build` after each change.

---

## 📜 Code conventions

- **Python**: PEP8, type hints, `async/await`, externalized prompts, structured
  JSON LLM outputs.
- **TypeScript**: functional components + hooks, React Query for API calls,
  ESLint + Prettier.
- **Git**: `feat/` `fix/` `refactor/` `docs/` branches, conventional commits.
  Never commit `.env`, `credentials/`, `token.json`.
