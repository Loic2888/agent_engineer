# Invoice Processing Agent

Agentic application that processes invoices automatically.  
Drop a PDF or image of an invoice — the agent classifies the document, extracts the key fields (issuer, address, amount due, due date) and records them in a SQLite database. No manual data entry required.

---

## How it works

```
Invoice (PDF / PNG / JPG / WEBP)
        │
        ▼
  Step 1 — Conversion
  PDF → markdown text   (images sent directly to Gemini vision)
        │
        ▼
  Step 2 — Classification
  Gemini decides: is this an invoice?
        │
        ├── No  ──▶  { "status": "skipped" }
        │
        ▼
  Step 3 — Field extraction
  Gemini function calling → record_invoice(issuer, address, amount_due, currency, due_date)
        │
        ▼
  Step 4 — Database write
  Fields inserted into SQLite invoices table
        │
        ▼
  { "status": "recorded", "invoice_id": 42, "fields": { … } }
```

**Model used:** `gemini-2.5-flash` (Google Gemini API)

---

## Quick start — Docker (recommended)

### 1. Copy and fill in the environment file

```bash
cp .env.example .env
```

Edit `.env` and set your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=./data/invoices.db
PORT=3001
```

Get a free key at [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. Build and start the container

```bash
docker compose up --build -d
```

### 3. Open the web interface

[http://localhost:3001](http://localhost:3001)

### 4. Stop the container

```bash
docker compose down
```

---

## Quick start — Windows one-click

Double-click **`launch.bat`**.  
The script will:
1. Check that Docker Desktop is installed
2. Create `.env` from `.env.example` if it does not exist (and open it in Notepad so you can fill in your key)
3. Run `docker compose up --build -d`
4. Open [http://localhost:3001](http://localhost:3001) in your default browser

---

## Running without Docker (local Node.js)

### 1. Prerequisites

- Node.js ≥ 18

### 2. Install dependencies

```bash
npm install
```

### 3. Configure `.env`

```bash
cp .env.example .env
# then edit .env and set GEMINI_API_KEY
```

### 4. Start the server

```bash
# Development — auto-reload on file changes
npm run dev

# Production
npm start
```

The app listens on the port defined by `PORT` in `.env` (default `3001`).  
Open [http://localhost:3001](http://localhost:3001).

---

## Web interface

The app serves a simple web UI at the root URL:

| Feature | Description |
|---|---|
| Drag & drop zone | Drop a file directly onto the page to upload it |
| File picker | Click "Choisir un fichier" to browse |
| Result card | Displays extracted fields or the skip reason after processing |
| Invoice table | Lists all recorded invoices (issuer, amount, due date, file name, creation date) |
| Refresh button | Reloads the invoice list without reloading the page |

Supported formats: **PDF, PNG, JPG, WEBP** — max **20 MB**.

---

## REST API

The web UI and any external tool share the same API.

### Upload an invoice

```
POST /invoices/upload
Content-Type: multipart/form-data
```

| Field | Type | Description |
|---|---|---|
| `file` | File | PDF or image to process |

**Response — invoice recorded (HTTP 200):**

```json
{
  "status": "recorded",
  "invoice_id": 42,
  "fields": {
    "issuer": "Tech Flow Solutions",
    "address": "123 Business Ave, Suite 100",
    "amount_due": 3000,
    "currency": "USD",
    "due_date": "2025-08-20"
  }
}
```

**Response — document is not an invoice (HTTP 200):**

```json
{
  "status": "skipped",
  "reason": "Document is not an invoice."
}
```

**Error responses:**

| HTTP code | Cause |
|---|---|
| `400` | Wrong file type or file exceeds 20 MB |
| `422` | Gemini API error or unexpected response |
| `500` | Database write failure |

**Example with curl:**

```bash
curl -X POST http://localhost:3001/invoices/upload \
  -F "file=@invoice.pdf"
```

---

### List all invoices

```
GET /invoices
```

Returns a JSON array of all recorded invoices, sorted by creation date (newest first).

---

### Get a single invoice

```
GET /invoices/:id
```

Returns a single invoice object or `404` if not found.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey)) |
| `DATABASE_URL` | ❌ | `./data/invoices.db` | Path to the SQLite database file |
| `PORT` | ❌ | `3001` | Port the Express server listens on |

> **Changing the database engine**  
> The app uses SQLite by default. To switch to PostgreSQL, MySQL, or another engine:  
> 1. Update `DATABASE_URL` to the appropriate connection string  
> 2. Adapt `src/db/database.js` to use the corresponding driver  
> No other file needs to change — the rest of the app reads the connection through that single module.

---

## Project structure

```
invoice-processing/
├── launch.bat              # Windows one-click launcher
├── docker-compose.yml      # Container orchestration
├── Dockerfile
├── .env.example            # Environment variable template
├── package.json
├── public/                 # Static web UI
│   ├── index.html
│   ├── style.css
│   └── app.js
└── src/
    ├── index.js            # Express entry point — serves static + mounts routes
    ├── agent/
    │   ├── pipeline.js     # Orchestrates the 4 steps (no business logic here)
    │   ├── convert.js      # Step 1 — PDF → text, images → base64 marker
    │   ├── classify.js     # Step 2 — Gemini classification
    │   ├── extract.js      # Step 3 — Gemini function calling (record_invoice)
    │   └── tools.js        # Gemini functionDeclarations schema
    ├── db/
    │   ├── database.js     # SQLite connection (reads DATABASE_URL from .env)
    │   ├── schema.sql      # Table definitions
    │   └── invoices.js     # insert / list / getById helpers
    └── routes/
        ├── upload.js       # POST /invoices/upload — multer + pipeline
        └── invoices.js     # GET /invoices, GET /invoices/:id
```

---

## Gitignored files

The following are never committed:

- `.env` — contains secrets
- `data/invoices.db` — database file (persisted via Docker volume in production)
- `uploads/` — temporary storage, auto-deleted after each pipeline run
- `node_modules/`

---

## Requirements

- **Docker Desktop** (recommended) — [download](https://www.docker.com/products/docker-desktop)
- **or** Node.js ≥ 18 for a local run
- A Google Gemini API key — [Google AI Studio](https://aistudio.google.com/app/apikey)
