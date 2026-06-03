# CLAUDE.md — WEBtoPDF

## Project overview

Agentic web application with two conversion modes:
- **Mode A** : HTML/CSS files → single PDF
- **Mode B** : PDF → HTML file + CSS file

The app runs fully in Docker Compose and exposes a web UI where the user picks a mode, uploads files, and downloads the result.

---

## Repository layout

```
WEBtoPDF/
├── CLAUDE.md                  ← this file
├── .env                       ← GEMINI_API_KEY (never commit)
├── .env.example
├── start.bat                  ← Windows launcher
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.js           ← Express entry point
│   │   ├── router.js          ← POST /convert, mode detection
│   │   ├── agents/
│   │   │   ├── orchestrator.js
│   │   │   ├── planningAgent.js
│   │   │   ├── rendererAgent.js   ← Mode A: Puppeteer → PDF
│   │   │   ├── qaAgent.js         ← Mode A: PDF validation
│   │   │   ├── repairAgent.js     ← Mode A: CSS patch loop
│   │   │   ├── parserAgent.js     ← Mode B: pdf-parse → AST
│   │   │   ├── writerAgent.js     ← Mode B: Gemini → HTML+CSS
│   │   │   └── validatorAgent.js  ← Mode B: diff check
│   │   ├── llm/
│   │   │   └── gemini.js      ← Gemini API wrapper (shared)
│   │   └── utils/
│   │       ├── fileHelpers.js
│   │       └── logger.js
│   └── uploads/               ← temp files (git-ignored)
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

> **Sibling projects** : The `WEBtoPDF/` folder sits alongside other projects at the same level. Before writing any Gemini API call, read `../*/` sibling directories and locate any `gemini.js`, `llm.js`, or similar LLM wrapper. Extract the model name string used there (e.g. `gemini-1.5-pro`, `gemini-2.0-flash`, etc.) and use the **exact same model** in `backend/src/llm/gemini.js`. Do not hardcode a model name without checking siblings first.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (Alpine) |
| Web framework | Express 5 |
| PDF rendering | Puppeteer (headless Chrome) |
| PDF parsing | pdf-parse + pdfjs-dist |
| LLM | Google Gemini (via `@google/generative-ai`) |
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| Orchestration | Docker Compose v3.8 |

---

## Environment variables

```
# .env  (copy from .env.example, never commit)
GEMINI_API_KEY=your_key_here
PORT=3000
MAX_RETRIES=3          # max repair/validator loop iterations
UPLOAD_SIZE_LIMIT=50mb
```

---

## Docker Compose

```yaml
# docker-compose.yml
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./backend/uploads:/app/uploads
    restart: unless-stopped
```

The frontend is served as static files by Express (`express.static('frontend')`), so no separate container is needed.

---

## Windows launcher

```bat
@echo off
REM start.bat — builds and starts the full stack
cd /d "%~dp0"
docker-compose down --remove-orphans
docker-compose up --build
```

Double-click `start.bat` to rebuild and launch. The app is then available at **http://localhost:3000**.

---

## Agentic flow

### Mode A — HTML/CSS → PDF

```
[POST /convert?mode=html-to-pdf]
  └─ orchestrator
       ├─ planningAgent    : list HTML files, detect linked CSS/assets
       ├─ rendererAgent    : Puppeteer headless → PDF bytes
       ├─ qaAgent          : check page count, no blank pages, no missing assets
       └─ repairAgent      : if QA fails → patch CSS (@page, page-break) → retry rendererAgent
                             max MAX_RETRIES iterations, then return best attempt + warnings
```

### Mode B — PDF → HTML/CSS

```
[POST /convert?mode=pdf-to-html]
  └─ orchestrator
       ├─ planningAgent    : detect page count, image presence, multi-column layout
       ├─ parserAgent      : pdf-parse → raw text + structure AST
       ├─ writerAgent      : Gemini prompt → { html: string, css: string }
       └─ validatorAgent   : screenshot diff (Puppeteer) vs PDF page 1
                             if delta > threshold → send diff context back to writerAgent
                             max MAX_RETRIES iterations
```

Each agent receives and returns a **job context object** :

```js
{
  mode: 'html-to-pdf' | 'pdf-to-html',
  files: [...],          // Buffer arrays
  attempt: 0,            // incremented on retry
  errors: [],            // accumulated error list
  warnings: [],
  output: null           // filled by the last successful agent
}
```

---

## Gemini wrapper contract

`backend/src/llm/gemini.js` must export a single async function:

```js
/**
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}  raw text response
 */
export async function ask(systemPrompt, userPrompt) { ... }
```

**Model selection rule** (mandatory, checked before first implementation):
1. Scan `../../*/` for any file containing `genai.getGenerativeModel` or `new GoogleGenerativeAI`.
2. Extract the model name string.
3. Use that exact model name.
4. If no sibling uses Gemini yet, default to `gemini-1.5-flash` and leave a `// TODO: verify model` comment.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Serves `frontend/index.html` |
| `POST` | `/convert` | `?mode=html-to-pdf` or `?mode=pdf-to-html` — multipart/form-data |
| `GET` | `/health` | Returns `{ status: "ok" }` |

**POST /convert** response shape:

```json
{
  "success": true,
  "outputFile": "result.pdf",         // or "result.html" + "result.css"
  "downloadUrl": "/download/abc123",
  "warnings": [],
  "attempts": 1
}
```

---

## Frontend UI requirements

- Single-page, no framework.
- Two large cards/buttons: **"HTML/CSS → PDF"** and **"PDF → HTML/CSS"**.
- After mode selection: file drop zone (accepts multiple files for Mode A, single PDF for Mode B).
- Progress indicator during processing (spinner + current agent name streamed via SSE or polling `/status/:jobId`).
- On success: download button(s).
- On error: show `errors[]` and `warnings[]` from the job context.

---

## Code style

- ES modules (`"type": "module"` in package.json).
- Async/await everywhere, no callback hell.
- Each agent is a pure async function: `async function runXxxAgent(ctx) → ctx`.
- Log with `logger.js` (wraps `console` with timestamps and agent names).
- No business logic in `index.js` or `router.js` — they only wire HTTP to the orchestrator.

---

## What Claude Code should do first

1. Read sibling project directories to identify the Gemini model name in use.
2. Create `.env.example` with all variables documented.
3. Scaffold `docker-compose.yml` and `backend/Dockerfile`.
4. Implement `backend/src/llm/gemini.js` using the model found in step 1.
5. Implement agents in order: `planningAgent` → `rendererAgent` → `qaAgent` → `repairAgent` (Mode A), then `parserAgent` → `writerAgent` → `validatorAgent` (Mode B).
6. Build the frontend last, once the API contract is stable.
7. Verify `start.bat` launches the stack cleanly on Windows (CRLF line endings, `cd /d "%~dp0"`).

---

## Out of scope (MVP)

- Authentication / user accounts
- Persistent job history
- Cloud storage (S3, GCS)
- Batch queue (BullMQ, etc.)
- CSS preprocessors (Sass, Less) — plain CSS only

---

## Known constraints

- Puppeteer in Docker requires `--no-sandbox` and the `chromium` Alpine package.
- `pdf-parse` struggles with scanned PDFs (no OCR). Log a warning in that case; do not crash.
- Gemini responses for HTML/CSS must be requested as JSON (`{ html, css }`) with `responseMimeType: "application/json"` to avoid markdown fences.
- Upload temp files must be cleaned up after job completion (use `finally` block in orchestrator).
