# WEBtoPDF — Agentic conversion application

A full web application that converts files in both directions:

- **Mode A**: HTML/CSS → PDF (rendered via Puppeteer)
- **Mode B**: PDF → HTML/CSS (visual reconstruction via multi-agent AI)

Mode B uses a **multi-agent** architecture. Text is placed **deterministically** at its
exact coordinates (extracted from the PDF), then a visual enrichment loop
(screenshot → Gemini vision → score) adjusts colors and backgrounds until reaching 80%
similarity with the original document. Text is never guessed or moved: it comes directly
from the PDF's x/y positions.

---

## Table of contents

- [Agentic architecture](#agentic-architecture)
- [Mode A pipeline — HTML/CSS → PDF](#mode-a-pipeline--htmlcss--pdf)
- [Mode B pipeline — PDF → HTML/CSS](#mode-b-pipeline--pdf--htmlcss)
- [Agent descriptions](#agent-descriptions)
- [Real-time — JobStore & SSE](#real-time--jobstore--sse)
- [Tech stack](#tech-stack)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Running](#running)
- [Dependencies](#dependencies)

---

## Agentic architecture

```
HTTP request
     │
     ▼
 Orchestrator
     │
     ├─ planningAgent    ← analyzes the document structure
     ├─ parserAgent      ← extracts text with exact x/y positions
     ├─ screenshotAgent  ← renders each page to a PNG image
     ├─ builderAgent     ← places text at its exact coordinates (deterministic)
     ├─ styleAgent       ← adds colors/backgrounds based on the screenshot
     └─ validatorAgent   ← compares visually, generates corrections
              │
              └─ loop (max 10 retries) — styleAgent only, until score ≥ 80%
```

Each agent is an `async (ctx) → ctx` function. They pass around a `ctx` object (job
context) that accumulates results throughout the pipeline.

---

## Mode A pipeline — HTML/CSS → PDF

```
[POST /convert?mode=html-to-pdf]
         │
         ▼
  planningAgent      → detects the uploaded HTML/CSS files
         │
         ▼
  rendererAgent      → launches Puppeteer (headless Chrome) → generates the PDF
         │
         ▼
  qaAgent            → checks the PDF is not empty (size, pages)
         │
         ├─ OK  → returns the PDF
         │
         └─ KO  → repairAgent → Gemini fixes the CSS (@page, page-break)
                      └─ retry rendererAgent + qaAgent (max 8 times)
```

---

## Mode B pipeline — PDF → HTML/CSS

```
[POST /convert?mode=pdf-to-html]
         │
         ▼
  planningAgent      → analyzes the visual structure via pdfjs-dist
                        (column count, boundary, font sizes)
         │
         ▼
  parserAgent        → extracts text with exact x/y positions per page
                        + each page's dimensions (positionedItems)
         │
         ▼
  screenshotAgent    → renders each PDF page to a <canvas> via pdfjs
                        → PNG screenshot of each page (visual reference)
         │
         ▼
  builderAgent       → places EACH text at its exact position (x/y/fontSize)
                        → <span> in position:absolute, no LLM
                        → all text present, no loss possible
                        → A4 format preserved
         │
         ▼
  styleAgent         → sends the HTML + screenshot to Gemini vision
                        → adds colors, backgrounds, sidebars, fonts
                        → does NOT move or remove any text
                        → guardrail: rejected if any text disappears
         │
         ▼
  validatorAgent     → screenshot of the rendered HTML (same dimensions as the PDF)
                        → compares with the PDF screenshot via Gemini vision
                        → score 0–100 + list of precise corrections
         │
         ├─ score ≥ 80% → returns the HTML/CSS ✅
         │
         └─ score < 80% → corrections sent to styleAgent → retry
                            (text placement stays fixed, only the
                             style is adjusted at each iteration)
```

---

## Agent descriptions

### `planningAgent`
Analyzes the first PDF file with `pdfjs-dist` to detect:
- The number of pages
- The presence of a multi-column layout (detecting the horizontal gap in the x positions of text blocks)
- The boundary between columns (in pixels)
- The font-size threshold to distinguish headings from body text

### `parserAgent`
Extracts all text from the PDF page by page via `pdfjs-dist`, with the x/y coordinates of each block. Groups blocks:
- By column (left if `x < boundary`, right otherwise)
- By line (same y ± 3pt)
- By type (heading if `fontSize ≥ threshold`, otherwise body)

Exposes the raw positioned data (`positionedItems`: text + `x/y/fontSize` + page) and each page's dimensions, consumed by the `builderAgent` for deterministic placement.

### `screenshotAgent`
Launches a headless Puppeteer browser. Loads `pdfjs-dist` from the Express server (`/pdfjs/...`) in an HTML page, renders each PDF page to a `<canvas>`, then takes a PNG screenshot. These images serve as the **visual reference** for the `styleAgent` and `validatorAgent`.

### `builderAgent`
**No LLM.** Builds the HTML/CSS directly from the exact coordinates extracted by the `parserAgent`. Each piece of text becomes a `<span class="t">` in `position: absolute`, placed at its exact position:
- `left = x`, `top = pageHeight − y − fontSize` (conversion from PDF bottom-left origin → HTML top-left)
- `font-size = fontSize`, heavier weight for headings
- Page in exact A4 format, white background by default

Since each text is laid at its coordinate, **no text can be lost or misplaced** — it is deterministic and reproducible. This is what guarantees a high-fidelity baseline before any iteration.

### `styleAgent`
Sends the deterministic HTML + the PDF screenshot to **Gemini 2.5 Flash** (multimodal). Gemini adds only the **visual layer**: text colors, page backgrounds, colored panels/sidebars (via decorative `<div>`s placed *behind* the text), fonts and weights. Strict instruction: never move or remove a text `<span>`. A **guardrail** counts the spans before/after: if more than 5% of the text disappears, the output is rejected and the previous version is kept. On retry, it receives the `validatorAgent`'s list of corrections.

### `validatorAgent`
1. Renders the HTML/CSS in Puppeteer with a viewport matched to the exact PDF page dimensions
2. Takes a screenshot of the HTML render
3. Sends both images (original PDF + rendered HTML) to Gemini vision
4. Gemini returns a **score 0–100** and a **list of precise corrections** (e.g. `"Left sidebar background should be #1e2b3c, currently white"`)
5. If `score < threshold` → corrections passed to the `styleAgent` for a new cycle (text placement stays fixed)

### `repairAgent` *(Mode A only)*
Used when the PDF generated by Puppeteer fails QA validation. Sends the errors and the original CSS to Gemini, which generates a corrective CSS targeting `@page`, `page-break`, and print layout issues.

### `qaAgent` *(Mode A only)*
Checks that the generated PDF is not empty (minimum size in bytes, file accessibility).

---

## Real-time — JobStore & SSE

Conversion can take **30 seconds to 3 minutes** depending on the number of pages and
retries. To avoid the browser waiting silently:

1. `POST /convert` returns a `{ jobId }` immediately and starts processing in the background
2. The frontend opens a **Server-Sent Events** connection on `GET /status/:jobId`
3. Each agent action emits a real-time message:

```
📋 Analyzing PDF structure...
📋 3 page(s) — 2-column layout
📝 847 text elements extracted
📸 Screenshot page 1/3...
📸 Screenshot page 2/3...
📸 Screenshot page 3/3...
🎨 Reconstructing visual layout from screenshots...
🎨 Layout skeleton generated
✍️ Placing text content (attempt 1)...
🔍 Comparing with original PDF...
⚠️ Score 72/100 — 2 issue(s) to fix
   1. Left sidebar background should be dark navy
   2. Section headings missing orange color
🔄 Correction attempt 2/8...
✍️ Placing text content (attempt 2)...
✅ Score 93/100 — validation passed!
```

The `jobStore` is an in-memory event bus (`Map`) that stores messages and broadcasts
them to all connected SSE clients. Jobs are automatically removed 2 minutes after they
finish.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (Alpine) |
| Web framework | Express 5 |
| PDF rendering | Puppeteer-core + Chromium |
| PDF parsing | pdfjs-dist 3.x + pdf-parse |
| LLM / Vision | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Real-time | Server-Sent Events (native SSE) |
| Frontend | Vanilla HTML/CSS/JS |
| Containerization | Docker Compose |

---

## Installation

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### 1. Clone / get the project

```bash
git clone <repo-url>
cd WEBtoPDF
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set the API key:

```env
GEMINI_API_KEY=your_key_here
```

### 3. Launch the application

**Windows** — double-click `start.bat`

**Linux / macOS**:
```bash
docker compose up --build
```

The application is available at **http://localhost:3002**

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | Google Gemini API key (required) |
| `PORT` | `3002` | Server listening port |
| `MAX_RETRIES` | `8` | Maximum number of correction attempts |
| `UPLOAD_SIZE_LIMIT` | `50mb` | Maximum uploaded file size |
| `VISUAL_SIMILARITY_THRESHOLD` | `80` | Minimum score (0–100) to validate the result |

---

## Running

```bash
# Start (rebuilding the image)
docker compose up --build

# Start without rebuilding (faster if the code hasn't changed)
docker compose up

# Stop
docker compose down

# Follow logs in real time
docker compose logs -f
```

---

## Dependencies

This project is **Node.js**. The `backend/package.json` file is the equivalent of a
Python `requirements.txt` — it lists all the npm dependencies.

### Application dependencies (`backend/package.json`)

| Package | Version | Role |
|---|---|---|
| `express` | ^5.0.0 | Web server, routing, SSE |
| `multer` | ^1.4.5-lts.1 | Multipart file upload |
| `puppeteer-core` | ^22.0.0 | Chromium control (PDF rendering, screenshots) |
| `@google/generative-ai` | ^0.21.0 | Gemini SDK (vision, JSON generation) |
| `pdf-parse` | ^1.1.1 | Raw text extraction from PDF |
| `pdfjs-dist` | ^3.11.174 | Positioned text extraction + canvas rendering |
| `uuid` | ^9.0.0 | Unique identifier generation (jobs, files) |

### System dependencies (installed via Docker / Alpine)

| Package | Role |
|---|---|
| `chromium` | Headless browser used by Puppeteer |

These system dependencies are managed automatically in the `Dockerfile` — no manual
installation needed.

### Installing npm dependencies (outside Docker)

If you want to run the backend outside Docker:

```bash
cd backend
npm install
node src/index.js
```

> **Note**: outside Docker, Chromium must be installed separately on the system, and
> `PUPPETEER_EXECUTABLE_PATH` must point to its executable.
