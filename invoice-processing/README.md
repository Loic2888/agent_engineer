# Invoice Processing Agent

Agentic application that processes invoices automatically.  
Drop a PDF or image of an invoice — the agent extracts the key fields (issuer, address, amount due, due date) and records them in a database, no manual data entry required.

---

## How it works

```
Invoice (PDF/image)
      │
      ▼
 PDF → text (markdown)
      │
      ▼
 Classification  ──── not an invoice? ──▶  skipped
      │
      ▼
 Field extraction (LLM tool call)
      │
      ▼
 Database write
      │
      ▼
 Recorded invoice ✓
```

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/your-username/invoice-agent.git
cd invoice-agent
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
DATABASE_URL=./data/invoices.db
PORT=3000
```

> **Changing the database**  
> By default the app uses a local SQLite file (`./data/invoices.db`).  
> To use a different database engine (PostgreSQL, MySQL, etc.), update the `DATABASE_URL` value in `.env` and adapt `src/db/database.js` to use the corresponding driver.  
> No other file needs to change — the rest of the app reads the connection through that single module.

### 3. Initialise the database

```bash
npm run db:init
```

This creates the `invoices` table if it does not already exist.

### 4. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The API listens on `http://localhost:3000` by default.

---

## API

### Upload an invoice

```
POST /invoices/upload
Content-Type: multipart/form-data
```

| Field | Type | Description |
|---|---|---|
| `file` | File | PDF or image of the invoice |

**Response — invoice recorded:**

```json
{
  "status": "recorded",
  "invoice_id": 1,
  "fields": {
    "issuer": "Tech Flow Solutions",
    "address": "123 Business Ave, Suite 100",
    "amount_due": 3000,
    "currency": "USD",
    "due_date": "2025-08-20"
  }
}
```

**Response — document is not an invoice:**

```json
{
  "status": "skipped",
  "reason": "Document is not an invoice"
}
```

### List all invoices

```
GET /invoices
```

### Get a single invoice

```
GET /invoices/:id
```

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Your Anthropic API key |
| `DATABASE_URL` | ✅ | `./data/invoices.db` | Database connection string. Change here to switch engines. |
| `PORT` | ❌ | `3000` | Port the Express server listens on |

---

## Project structure

```
invoice-agent/
├── src/
│   ├── index.js          # Server entry point
│   ├── agent/            # Agentic pipeline (convert, classify, extract)
│   ├── db/               # Database connection and helpers
│   └── routes/           # Express route handlers
├── uploads/              # Temporary file storage (auto-cleaned)
├── data/                 # SQLite database file (gitignored)
├── .env.example          # Environment variable template
└── CLAUDE.md             # Architecture and coding instructions
```

---

## Gitignored files

The following are never committed:

- `.env` — contains secrets
- `data/invoices.db` — database file
- `uploads/` — temporary uploaded files
- `node_modules/`

---

## Requirements

- Node.js ≥ 18
- An [Anthropic API key](https://console.anthropic.com/)
