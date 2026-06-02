# CLAUDE.md — Deep Research Agent

Fichier de contexte pour Claude Code. Lis-le entièrement avant toute action.

---

## Vue d'ensemble du projet

Application agentique de deep research : l'utilisateur soumet une question, un pipeline
multi-agents collecte, synthétise et rédige un rapport Markdown structuré avec citations.
<<<<<<< HEAD

**Stack :**
- Backend : Python 3.12 + FastAPI + LangGraph
- LLM : Google Gemini (gemini-2.0-flash via google-generativeai SDK)
- Recherche web : Tavily API + SerpAPI (fallback)
=======
Les recherches sont sauvegardées dans une base SQLite et un système de similarité évite
les doublons.

**Stack :**
- Backend : Python 3.12 + FastAPI + LangGraph
- LLM : Google Gemini (`gemini-2.5-flash` via `google-generativeai` SDK)
- Recherche web : Tavily API + SerpAPI (fallback)
- Base de données : SQLite via `aiosqlite`
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
- Frontend : React 19 + Vite + TailwindCSS
- Streaming : Server-Sent Events (SSE)
- Config : python-dotenv

---

## Structure du projet

```
deep-research/
├── CLAUDE.md
<<<<<<< HEAD
├── .env                        # clés API (jamais committé)
├── .env.example
├── .gitignore
│
├── backend/
│   ├── main.py                 # point d'entrée FastAPI
=======
├── setup.py                    # script de lancement automatique (double-clic)
├── launch.bat                  # wrapper Windows double-cliquable → appelle setup.py
├── .env                        # clés API (jamais committé)
├── .env.example
├── .gitignore
├── docker-compose.yml          # backend + frontend + volume SQLite
│
├── backend/
│   ├── main.py                 # point d'entrée FastAPI + lifespan DB
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
│   ├── requirements.txt
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── planner.py          # décompose la question en sous-questions
│   │   ├── researcher.py       # collecte + exploration web
│   │   ├── synthesizer.py      # déduplication + classement
│   │   ├── writer.py           # rédige le plan puis le rapport final
│   │   └── editor.py           # révision critique + demande de corrections
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── tavily_search.py    # wrapper Tavily
│   │   ├── serp_search.py      # wrapper SerpAPI (fallback)
│   │   └── scraper.py          # extraction contenu page web
│   │
│   ├── graph/
│   │   ├── __init__.py
│   │   ├── state.py            # ResearchState (TypedDict LangGraph)
│   │   └── pipeline.py         # définition du graph LangGraph
│   │
<<<<<<< HEAD
=======
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py         # init SQLite (CREATE TABLE IF NOT EXISTS)
│   │   └── crud.py             # save / list / get / delete / find_similar
│   │
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
│   └── utils/
│       ├── __init__.py
│       └── markdown.py         # formatage du rapport final
│
└── frontend/
    ├── index.html
    ├── package.json
<<<<<<< HEAD
=======
    ├── nginx.conf              # proxy /research (SSE) + /history → backend
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── components/
        │   ├── SearchBar.tsx       # input + bouton lancer
        │   ├── ProgressSteps.tsx   # affiche l'étape en cours (SSE)
        │   ├── ReportViewer.tsx    # rendu Markdown du rapport final
<<<<<<< HEAD
        │   └── SourceCard.tsx      # carte pour chaque source citée
        └── lib/
            └── api.ts              # appels backend + parsing SSE
=======
        │   ├── SourceCard.tsx      # carte pour chaque source citée
        │   ├── HistoryPanel.tsx    # sidebar gauche — liste des recherches passées
        │   └── SimilarityModal.tsx # modal proposant les recherches similaires
        └── lib/
            └── api.ts              # appels backend + parsing SSE + fonctions history
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
```

---

## Variables d'environnement

```bash
# .env.example — copier en .env et remplir

GEMINI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
SERPAPI_API_KEY=...

<<<<<<< HEAD
# Optionnel
=======
# Injecté automatiquement par docker-compose (ne pas modifier)
DB_PATH=/data/research.db

# Optionnel (local dev uniquement)
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173
```

---

## Stack détaillée et justifications

### Backend

| Package | Version | Rôle |
|---|---|---|
| `fastapi` | latest | Framework API async |
| `uvicorn[standard]` | latest | Serveur ASGI |
| `langgraph` | latest | Orchestration du pipeline agentique |
| `google-generativeai` | latest | SDK Gemini officiel |
| `tavily-python` | latest | Recherche web Tavily |
| `google-search-results` | latest | SerpAPI |
| `httpx` | latest | Requêtes HTTP async (scraping) |
| `beautifulsoup4` | latest | Parsing HTML |
| `python-dotenv` | latest | Chargement .env |
| `pydantic` | v2 | Validation des données |
<<<<<<< HEAD
=======
| `aiosqlite` | latest | SQLite async — persistance de l'historique |
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d

```bash
# Installation backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend

```bash
# Installation frontend
cd frontend
npm install
```

| Package | Rôle |
|---|---|
| `react` + `react-dom` | UI |
| `vite` | Bundler ultra-rapide |
| `tailwindcss` | Styling |
| `react-markdown` | Rendu du rapport Markdown |
| `remark-gfm` | Support tableaux/liens dans Markdown |

---

## Architecture LangGraph — pipeline agentique

Le pipeline est un **graph dirigé** avec un état partagé (`ResearchState`).

```
[START]
   │
   ▼
[planner]          → décompose en sous-questions
   │
   ▼
[researcher]       → collecte Tavily + SerpAPI en parallèle
   │
   ▼
[synthesizer]      → déduplique, classe, filtre
   │
   ▼
[writer_outline]   → génère le plan du rapport
   │
   ▼
[editor]           → vérifie couverture et cohérence
   │         ╲
   │          → si insuffisant : retour vers [researcher]
   ▼
[writer_final]     → rédige le rapport Markdown complet
   │
   ▼
<<<<<<< HEAD
[END]
=======
[END — save to SQLite]
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
```

### ResearchState (graph/state.py)

```python
from typing import TypedDict, Annotated
from operator import add

class ResearchState(TypedDict):
    query: str                          # question originale
    sub_questions: list[str]            # sortie du planner
    raw_sources: Annotated[list, add]   # sources brutes accumulées
    ranked_sources: list[dict]          # sources filtrées et classées
    outline: str                        # plan du rapport
    editor_feedback: str                # retour de l'editor
    report: str                         # rapport final Markdown
    iteration: int                      # nombre de boucles research
    status: str                         # étape en cours (pour SSE)
```

---

<<<<<<< HEAD
## Streaming SSE — affichage en temps réel

Le frontend affiche l'avancement de chaque étape en temps réel via SSE.

### Backend (main.py)

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

@app.post("/research")
async def run_research(payload: ResearchRequest):
    async def event_stream():
        async for event in pipeline.astream({"query": payload.query}):
            data = json.dumps({"step": event["status"], "data": event})
            yield f"data: {data}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

### Frontend (lib/api.ts)

```typescript
export async function streamResearch(query: string, onStep: (step: string) => void) {
  const response = await fetch("/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const event = JSON.parse(line.slice(6));
        onStep(event.step);
      }
    }
  }
}
```
=======
## Historique et similarité

### Base de données (db/)

La DB SQLite est initialisée au démarrage du backend via `lifespan` FastAPI.
Chemin : `/data/research.db` dans le conteneur (volume Docker nommé `research_data`).

```sql
CREATE TABLE IF NOT EXISTS research (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    query       TEXT    NOT NULL,
    report      TEXT    NOT NULL,
    sources     TEXT    NOT NULL DEFAULT '[]',  -- JSON
    created_at  DATETIME DEFAULT (datetime('now'))
)
```

### Algorithme de similarité (db/crud.py → find_similar)

Avant chaque recherche, le frontend appelle `POST /history/similar`.
L'algorithme (sans LLM, < 50 ms) :

1. Tokenise + supprime les stop words (`what`, `is`, `the`, `how`…)
2. Calcule `max(Jaccard, containment_A→B, containment_B→A)`
3. Retourne les résultats avec score ≥ 0.5, triés par score desc, max 5

Si des correspondances sont trouvées, un modal propose :
- **Voir →** : charge la recherche depuis la DB (instantané)
- **Nouvelle recherche à jour** : force le pipeline

### Persistance

Le volume Docker `research_data` survit aux rebuilds, restarts et `docker compose down`.
Seul `docker compose down -v` supprime les données.

---

## Streaming SSE — affichage en temps réel

Le backend émet un événement par nœud LangGraph terminé.
Un événement `saved` est émis après sauvegarde en DB (déclenche le refresh de l'historique).

Événements possibles : `planner` · `researcher` · `synthesizer` · `writer_outline` · `editor` · `writer_final` · `saved` · `error`
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d

---

## Comportement des agents

### planner.py
- Reçoit `query`
- Prompt : décomposer en 3 à 5 sous-questions précises et complémentaires
- Retourne : `sub_questions: list[str]`

### researcher.py
- Reçoit `sub_questions`
- Pour chaque sous-question : appel Tavily en priorité, SerpAPI en fallback
- Scrape les 3 premières URLs par sous-question
- Accumule dans `raw_sources`

### synthesizer.py
- Reçoit `raw_sources`
- Déduplique par URL
- Classe par pertinence (score Tavily) + récence
<<<<<<< HEAD
- Retourne `ranked_sources` (max 15 sources)
=======
- Retourne `ranked_sources` (max 15 sources, tronqués à 2 000 chars)
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d

### writer.py (outline)
- Reçoit `ranked_sources`
- Génère un plan Markdown structuré (titres H2/H3)
- Retourne `outline`

### editor.py
- Reçoit `outline` + `ranked_sources`
- Vérifie : couverture des sous-questions, citations disponibles, cohérence
- Si OK : passe à `writer_final`
- Si insuffisant (max 2 itérations) : retour vers `researcher` avec feedback

### writer.py (final)
- Reçoit `outline` + `ranked_sources` + `editor_feedback`
- Rédige le rapport complet en Markdown
- Format : introduction, sections H2, conclusion, section `## Références`
- Chaque affirmation citée avec `[1]`, `[2]`…

---

## Règles de développement

### Général
- Toujours travailler dans le virtualenv Python activé
- Ne jamais committer `.env` (vérifie `.gitignore` avant chaque commit)
- Un agent = un fichier dans `agents/`
- Un outil = un fichier dans `tools/`
<<<<<<< HEAD
=======
- Toute nouvelle table SQLite → migration dans `db/database.py`
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d

### Python
- Type hints partout (Pydantic v2 pour les modèles de données)
- Fonctions async par défaut pour tout ce qui touche au réseau
- Pas de `print()` : utilise `logging` avec niveau `INFO`
- Gestion d'erreur explicite sur chaque appel API externe (try/except + fallback)

### LangGraph
- L'état (`ResearchState`) est la seule source de vérité
- Chaque nœud reçoit le state complet et retourne un dict partiel (uniquement les clés modifiées)
- La condition de boucle editor → researcher se base sur `iteration < 2`

### Frontend
- Composants fonctionnels React uniquement (pas de classes)
- Tailwind pour tout le styling, pas de CSS custom
- `ProgressSteps` se met à jour via les événements SSE en temps réel
- `ReportViewer` utilise `react-markdown` + `remark-gfm`
<<<<<<< HEAD
=======
- `HistoryPanel` se rafraîchit via prop `refreshTrigger` (nombre incrémenté)
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d

---

## Commandes utiles

```bash
<<<<<<< HEAD
# Docker — lancer tout le projet (depuis /deep-research)
=======
# Lancer l'app (Windows — double-clic ou terminal)
launch.bat
python setup.py

# Docker — rebuild complet
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
docker compose up --build

# Docker — rebuild un seul service
docker compose build backend
docker compose up -d backend

# Docker — voir les logs
docker compose logs -f backend

<<<<<<< HEAD
=======
# Docker — arrêter sans perdre les données
docker compose down

# Docker — arrêter ET supprimer les données
docker compose down -v

>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
# Local — Lancer le backend (depuis /backend)
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Local — Lancer le frontend (depuis /frontend)
npm run dev

# Tester un agent isolément
python -c "from agents.planner import run_planner; import asyncio; asyncio.run(run_planner('What is LangGraph?'))"

# Vérifier les imports
<<<<<<< HEAD
python -c "import langgraph, anthropic, tavily; print('OK')"
=======
python -c "import langgraph, google.generativeai, tavily; print('OK')"
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
```

---

<<<<<<< HEAD
## Ordre de développement recommandé

1. Setup projet (structure dossiers, .env, requirements.txt, vite init)
2. `graph/state.py` — définir ResearchState
3. `tools/tavily_search.py` — tester la recherche en isolation
4. `tools/serp_search.py` — tester le fallback
5. `agents/planner.py` — tester la décomposition de question
6. `agents/researcher.py` — tester collecte + scraping
7. `agents/synthesizer.py`
8. `agents/writer.py` (outline uniquement)
9. `agents/editor.py`
10. `agents/writer.py` (rapport final)
11. `graph/pipeline.py` — assembler le graph complet
12. `main.py` — exposer via FastAPI + SSE
13. Frontend — SearchBar + ProgressSteps + ReportViewer

---

=======
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
## Pièges connus

- **Boucle infinie** : toujours borner les itérations editor→researcher (`iteration < 2`)
- **Rate limit Tavily** : ajouter un `asyncio.sleep(0.5)` entre chaque appel si batch
- **CORS** : configurer `CORSMiddleware` dans `main.py` pour autoriser `localhost:5173`
- **SSE et proxies** : en prod, s'assurer que le reverse proxy ne bufferise pas le stream (header `X-Accel-Buffering: no`)
<<<<<<< HEAD
- **Tokens LLM** : le synthesizer doit tronquer les sources trop longues avant de les passer au writer (max ~2000 tokens par source)
=======
- **Tokens LLM** : le synthesizer tronque les sources à 2 000 chars avant de les passer au writer
- **Volume Docker** : ne jamais utiliser `docker compose down -v` en prod — supprime toutes les recherches
- **npm ci** : le Dockerfile frontend utilise `npm install` (pas `npm ci`) car il n'y a pas de `package-lock.json` dans le repo
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
