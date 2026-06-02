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
| LLM | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| PDF conversion | `pdf-parse` (local) or an external PDF-to-text API |
| Database | SQLite (via `better-sqlite3`) |
| Config | `.env` (see README) |

---

## Project structure

```
invoice-agent/
├── CLAUDE.md
├── README.md
├── .env.example
├── .env                  # gitignored
├── package.json
├── src/
│   ├── index.js          # Express entry point
│   ├── agent/
│   │   ├── pipeline.js   # Orchestrates the 4-step agentic workflow
│   │   ├── convert.js    # Step 1 — PDF/image → markdown text
│   │   ├── classify.js   # Step 2 — LLM classification (invoice vs other)
│   │   ├── extract.js    # Step 3 — LLM field extraction
│   │   └── tools.js      # Tool definitions passed to the Claude API
│   ├── db/
│   │   ├── database.js   # DB connection (reads DATABASE_URL from .env)
│   │   ├── schema.sql    # Table definitions
│   │   └── invoices.js   # DB helpers (insert, list, get by id)
│   └── routes/
│       ├── upload.js     # POST /invoices/upload
│       └── invoices.js   # GET /invoices, GET /invoices/:id
├── uploads/              # Temporary storage for uploaded files
└── data/
    └── invoices.db       # SQLite database file (gitignored)
```

---

## Agentic pipeline (`src/agent/pipeline.js`)

The pipeline follows these steps in sequence:

### Step 1 — Conversion (`convert.js`)
- Accept a file path (PDF or image).
- Use `pdf-parse` to extract raw text.
- Format the output as clean markdown for the LLM.
- Return the markdown string.

### Step 2 — Classification (`classify.js`)
- Call the Claude API with the converted text.
- System prompt: instruct the model to respond only with `{ "is_invoice": true/false }` JSON.
- If `is_invoice` is `false`, stop the pipeline and return a `skipped` status.

### Step 3 — Extraction (`extract.js`)
- Call the Claude API with **tool use**.
- Define a `record_invoice` tool (see `tools.js`) with the following input schema:
  ```json
  {
    "issuer":      "string",
    "address":     "string",
    "amount_due":  "number",
    "currency":    "string",
    "due_date":    "string (ISO 8601)"
  }
  ```
- The model fills the tool arguments from the invoice text.
- Return the extracted fields object.

### Step 4 — Database write (`db/invoices.js`)
- Insert the extracted fields into the `invoices` table.
- Add `created_at` timestamp automatically.
- Return the new record id.

---

## Tool definition (`src/agent/tools.js`)

```js
export const tools = [
  {
    name: "record_invoice",
    description: "Record the key fields extracted from an invoice into the database.",
    input_schema: {
      type: "object",
      properties: {
        issuer:     { type: "string",  description: "Name of the company issuing the invoice" },
        address:    { type: "string",  description: "Billing address of the issuer" },
        amount_due: { type: "number",  description: "Total amount due" },
        currency:   { type: "string",  description: "Currency code, e.g. USD, EUR" },
        due_date:   { type: "string",  description: "Payment due date in ISO 8601 format" }
      },
      required: ["issuer", "amount_due", "due_date"]
    }
  }
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
# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Database
# Default: SQLite file at ./data/invoices.db
# To switch to another engine, change this value and update src/db/database.js accordingly
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
  "reason": "Document is not an invoice"
}
```

---

## Error handling

- Wrap every `pipeline.js` call in try/catch; return HTTP 422 on LLM or parse failures.
- If the Claude API returns no tool call in Step 3, retry once with an explicit prompt nudge before throwing.
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

# Initialise the database (creates tables if not exist)
npm run db:init
```

---

## Key constraints

- **Do not hardcode** the Anthropic API key or the database path. Always read from `process.env`.
- **Do not commit** `.env` or `data/invoices.db` — both are in `.gitignore`.
- Keep each agent step in its own file; `pipeline.js` only orchestrates — no business logic there.
- The `uploads/` folder is temporary; delete the file after the pipeline completes successfully.
- The Claude API model string to use: `claude-sonnet-4-20250514`.
