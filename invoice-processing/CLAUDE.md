# CLAUDE.md — Invoice Processing Agent

## Project overview

Agentic application that automatically processes incoming invoices (PDF or image).
The pipeline extracts key fields (issuer, address, amount due, due date) and records them in a database, replacing a manual data-entry workflow.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (≥ 18) |
| API framework | Express.js |
| LLM | Google Gemini API (`gemini-2.5-flash`) |
| PDF conversion | `pdf-parse` (local) |
| Database | SQLite (via `better-sqlite3`) |
| Config | `.env` (see README) |

---

## Project structure

```
invoice-processing/
├── CLAUDE.md
├── README.md
├── .env.example
├── .env                  # gitignored
├── package.json
├── Dockerfile
├── docker-compose.yml
├── launch.bat            # Windows: build & open browser in one click
├── public/
│   ├── index.html        # Web UI (drag & drop upload + invoice list)
│   ├── style.css
│   └── app.js
└── src/
    ├── index.js          # Express entry point (serves static + API)
    ├── agent/
    │   ├── pipeline.js   # Orchestrates the 4-step agentic workflow
    │   ├── convert.js    # Step 1 — PDF/image → markdown text
    │   ├── classify.js   # Step 2 — Gemini classification (invoice vs other)
    │   ├── extract.js    # Step 3 — Gemini function-calling field extraction
    │   └── tools.js      # Gemini functionDeclarations for record_invoice
    ├── db/
    │   ├── database.js   # DB connection (reads DATABASE_URL from .env)
    │   ├── schema.sql    # Table definitions
    │   └── invoices.js   # DB helpers (insert, list, get by id)
    └── routes/
        ├── upload.js     # POST /invoices/upload
        └── invoices.js   # GET /invoices, GET /invoices/:id
```

---

## Agentic pipeline (`src/agent/pipeline.js`)

The pipeline follows these steps in sequence:

### Step 1 — Conversion (`convert.js`)
- Accept a file path (PDF or image).
- Use `pdf-parse` to extract raw text from PDFs.
- For images (PNG, JPG, WEBP), encode as base64 and pass directly to Gemini vision.
- Return the text string or a `{"__image__": true, base64, mime}` JSON marker.

### Step 2 — Classification (`classify.js`)
- Call Gemini with the converted content (text or image).
- System instruction: respond only with `{ "is_invoice": true/false }` JSON.
- If `is_invoice` is `false`, stop the pipeline and return a `skipped` status.

### Step 3 — Extraction (`extract.js`)
- Call Gemini with **function calling** (`toolConfig: { functionCallingConfig: { mode: "ANY" } }`).
- Defines a `record_invoice` function (see `tools.js`) with the following parameters:
  ```json
  {
    "issuer":      "string",
    "address":     "string",
    "amount_due":  "number",
    "currency":    "string",
    "due_date":    "string (ISO 8601)"
  }
  ```
- The model fills the function arguments from the invoice content.
- Return the extracted fields object.
- Retries once with an explicit nudge if Gemini returns no function call.

### Step 4 — Database write (`db/invoices.js`)
- Insert the extracted fields into the `invoices` table.
- Add `created_at` timestamp automatically.
- Return the new record id.

---

## Tool definition (`src/agent/tools.js`)

```js
export const functionDeclarations = [
  {
    name: 'record_invoice',
    description: 'Record the key fields extracted from an invoice into the database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        issuer:     { type: 'STRING',  description: 'Name of the company issuing the invoice' },
        address:    { type: 'STRING',  description: 'Billing address of the issuer' },
        amount_due: { type: 'NUMBER',  description: 'Total amount due' },
        currency:   { type: 'STRING',  description: 'Currency code, e.g. USD, EUR' },
        due_date:   { type: 'STRING',  description: 'Payment due date in ISO 8601 format' },
      },
      required: ['issuer', 'amount_due', 'due_date'],
    },
  },
];
```

---

## Database schema (`src/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  issuer      TEXT    NOT NULL,
  address     TEXT,
  amount_due  REAL    NOT NULL,
  currency    TEXT    NOT NULL DEFAULT 'USD',
  due_date    TEXT    NOT NULL,
  file_name   TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## Environment variables (`.env.example`)

```env
# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Database
DATABASE_URL=./data/invoices.db

# Server
PORT=3000
```

---

## API routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/invoices/upload` | Upload a PDF or image, run the full pipeline |
| `GET` | `/invoices` | List all recorded invoices |
| `GET` | `/invoices/:id` | Get a single invoice by id |

### `POST /invoices/upload` — response shape

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

If the document is not an invoice:

```json
{
  "status": "skipped",
  "reason": "Document is not an invoice."
}
```

---

## Error handling

- Wrap every `pipeline.js` call in try/catch; return HTTP 422 on LLM or parse failures.
- If Gemini returns no function call in Step 3, retry once with an explicit prompt nudge before throwing.
- File upload failures (wrong MIME type, file too large) return HTTP 400 with a clear message.
- DB write failures return HTTP 500 and log the error; do not expose raw SQL errors to the client.

---

## Development commands

```bash
# Install dependencies
npm install

# Run in dev mode (nodemon)
npm run dev

# Run in production
npm start
```

---

## Docker / quick start

```bash
# Build and start (detached)
docker compose up --build -d

# Stop
docker compose down
```

On Windows, double-click `launch.bat` — it builds the image, starts the container, and opens `http://localhost:3000` automatically.

---

## Key constraints

- **Do not hardcode** the Gemini API key or the database path. Always read from `process.env`.
- **Do not commit** `.env` or `data/invoices.db` — both are in `.gitignore`.
- Keep each agent step in its own file; `pipeline.js` only orchestrates — no business logic there.
- The `uploads/` folder is temporary; delete the file after the pipeline completes (success or failure).
- The Gemini model string to use: `gemini-2.5-flash`.
