# CLAUDE.md — NL-to-SQL Agent

Fichier de contexte pour Claude Code. Lis-le entièrement avant toute action.

---

## Vue d'ensemble du projet

Application agentique de conversion langage naturel → SQL.  
L'utilisateur pose une question en français ou en anglais, un pipeline LangGraph
interroge la base de données ciblée et retourne une réponse en langage naturel.

L'application est **universelle** : elle s'adapte automatiquement au type de base de
données (PostgreSQL, MySQL, SQLite, MSSQL…) via l'URL de connexion fournie dans `.env`.

**Périmètre : lecture seule.** Aucune requête `INSERT`, `UPDATE`, `DELETE`, `DROP`,
`CREATE`, `ALTER` ne doit jamais être générée ni exécutée.

---

## Stack technique

| Composant         | Technologie                                  |
|-------------------|----------------------------------------------|
| Orchestration     | Python + LangGraph                           |
| LLM               | Google Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Abstraction DB    | SQLAlchemy (universelle, multi-dialectes)    |
| Interface         | FastAPI + React + TypeScript                 |
| Containerisation  | Docker + Docker Compose                      |
| Lancement Windows | `start.bat`                                  |

---

## Structure du projet

```
nl-to-sql-agent/
├── CLAUDE.md
├── .env                          # Ne jamais committer
├── .env.example                  # Modèle à inclure dans le repo
├── start.bat                     # Lancement Windows double-clic
├── docker-compose.yml
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # Point d'entrée FastAPI
│   │
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── graph.py              # Définition du graph LangGraph
│   │   ├── state.py              # AgentState TypedDict
│   │   └── nodes/
│   │       ├── __init__.py
│   │       ├── detect_db.py      # Détection du dialecte depuis l'URL
│   │       ├── fetch_schema.py   # Introspection SQLAlchemy
│   │       ├── clarify.py        # Détection d'ambiguïté
│   │       ├── generate_sql.py   # Génération SQL via Gemini
│   │       ├── validate_sql.py   # Validation syntaxe + read-only
│   │       ├── execute_query.py  # Exécution SQLAlchemy
│   │       ├── retry.py          # Reformulation si erreur DB
│   │       └── translate.py      # Traduction résultat → langage naturel
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   └── connection.py         # Création engine SQLAlchemy depuis .env
│   │
│   └── config.py                 # Chargement variables d'environnement
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── components/
            ├── ChatWindow.tsx    # Historique de conversation
            ├── QueryInput.tsx    # Saisie de la question
            └── SqlDebugPanel.tsx # Affichage optionnel de la SQL générée
```

---

## Variables d'environnement

Fichier `.env` à la racine :

```env
# Connexion base de données
# Exemples :
# DATABASE_URL=postgresql://user:password@host:5432/dbname
# DATABASE_URL=mysql+pymysql://user:password@host:3306/dbname
# DATABASE_URL=sqlite:///./local.db
# DATABASE_URL=mssql+pyodbc://user:password@host/dbname?driver=ODBC+Driver+17+for+SQL+Server
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Clé API Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Configuration optionnelle
MAX_RETRIES=3
MAX_ROWS_RETURNED=100
SHOW_SQL_IN_UI=true
```

Fichier `.env.example` identique avec des valeurs fictives. Le `.env` réel est dans `.gitignore`.

---

## Pipeline agentique (LangGraph)

### Graphe de nœuds

```
[START]
   ↓
[detect_db_type]
   Lit DATABASE_URL, identifie le dialecte (postgresql / mysql / sqlite / mssql…)
   Stocke dans state["db_dialect"]
   ↓
[fetch_schema]
   SQLAlchemy inspect(engine) → liste tables, colonnes, types, clés étrangères
   Stocke dans state["schema"]
   ↓
[clarify_if_needed]
   Si la question est trop vague → retourne une demande de précision à l'utilisateur
   (edge conditionnel : si unclear → END avec message de clarification)
   ↓
[generate_sql]
   Prompt : question + schéma complet + dialecte DB
   Gemini 2.5 Flash génère la requête SQL
   Stocke dans state["sql_query"]
   ↓
[validate_sql]
   1. Validation syntaxique (sqlglot ou sqlparse)
   2. Read-only check : rejet immédiat si INSERT/UPDATE/DELETE/DROP/CREATE/ALTER détecté
   Si invalide → edge vers [retry] ou END avec message d'erreur
   ↓
[execute_query]
   SQLAlchemy execute(text(sql_query))
   Stocke rows dans state["raw_results"]
   Si erreur DB → edge vers [retry]
   ↓
[retry]  (MAX_RETRIES fois)
   Renvoie l'erreur DB + la SQL incorrecte à Gemini pour reformulation
   → retour vers [validate_sql]
   Si max retries atteint → END avec message d'échec
   ↓
[translate_response]
   Prompt : question originale + rows JSON → réponse en langage naturel
   Gemini 2.5 Flash rédige la réponse finale
   ↓
[END]
   Retourne : réponse naturelle + SQL générée (si SHOW_SQL_IN_UI=true)
```

### AgentState (state.py)

```python
from typing import TypedDict, Optional, Any

class AgentState(TypedDict):
    # Input
    user_question: str
    conversation_history: list[dict]

    # DB context
    db_dialect: str
    schema: dict                  # {table_name: [{col, type, nullable, pk, fk}]}

    # SQL pipeline
    sql_query: Optional[str]
    validation_error: Optional[str]
    raw_results: Optional[list[dict]]
    retry_count: int

    # Output
    natural_response: str
    needs_clarification: bool
    clarification_message: Optional[str]
    error_message: Optional[str]
```

---

## Règles de sécurité — READ-ONLY ABSOLUE

Le nœud `validate_sql` doit rejeter toute requête contenant les mots-clés suivants
(insensible à la casse) :

```python
FORBIDDEN_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "TRUNCATE", "REPLACE", "MERGE", "UPSERT", "GRANT", "REVOKE",
    "EXEC", "EXECUTE", "sp_", "xp_"
]
```

En cas de détection → ne pas exécuter, retourner un message d'erreur à l'utilisateur.

Limiter également le nombre de lignes retournées via `MAX_ROWS_RETURNED` (défaut : 100)
pour éviter des dumps complets de table.

---

## Dialectes SQL supportés

| URL prefix              | Dialecte détecté | Driver requis          |
|-------------------------|------------------|------------------------|
| `postgresql://`         | PostgreSQL       | `psycopg2`             |
| `mysql+pymysql://`      | MySQL/MariaDB    | `pymysql`              |
| `sqlite:///`            | SQLite           | stdlib (aucun)         |
| `mssql+pyodbc://`       | MSSQL            | `pyodbc`               |
| `oracle+cx_oracle://`   | Oracle           | `cx_Oracle`            |

La détection se fait par parsing du préfixe de `DATABASE_URL`.  
Le dialecte est injecté dans le prompt de génération SQL pour adapter la syntaxe.

---

## API FastAPI

### Endpoints principaux

| Méthode | Route           | Description                                  |
|---------|-----------------|----------------------------------------------|
| POST    | `/api/chat`     | Envoie une question, retourne la réponse     |
| GET     | `/api/schema`   | Retourne le schéma de la DB connectée        |
| GET     | `/api/health`   | Vérifie la connexion DB + statut de l'agent  |

### Schéma `/api/chat`

Request :
```json
{
  "question": "Combien de clients ont passé une commande ce mois-ci ?",
  "history": []
}
```

Response :
```json
{
  "answer": "Ce mois-ci, 142 clients ont passé au moins une commande.",
  "sql_query": "SELECT COUNT(DISTINCT customer_id) FROM orders WHERE ...",
  "execution_time_ms": 84
}
```

---

## Interface Frontend (React + TypeScript)

### Composants clés

- **`ChatWindow`** : historique scrollable des échanges, style chat
- **`QueryInput`** : champ texte + bouton Envoyer, support Entrée
- **`SqlDebugPanel`** : panneau rétractable affichant la SQL générée
  (visible uniquement si `SHOW_SQL_IN_UI=true`)

### Comportements attendus

- Spinner pendant l'exécution de l'agent
- Affichage de la SQL en bloc de code si `SHOW_SQL_IN_UI=true`
- Message d'erreur explicite si la question est rejetée (requête dangereuse, ambiguïté)
- Historique de conversation conservé en mémoire locale (session)

---

## Docker Compose

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

Le backend expose FastAPI sur le port `8000`.  
Le frontend expose React/Vite sur le port `3000`.

---

## Fichier start.bat (Windows)

```bat
@echo off
echo Demarrage de NL-to-SQL Agent...
docker-compose up --build -d
echo.
echo En attente du demarrage des services...
timeout /t 5 /nobreak > nul
start http://localhost:3000
echo Application lancee : http://localhost:3000
pause
```

---

## Ordre d'implémentation recommandé

1. `backend/db/connection.py` — engine SQLAlchemy depuis DATABASE_URL
2. `backend/agent/state.py` — AgentState TypedDict
3. `backend/agent/nodes/detect_db.py` — parsing dialecte
4. `backend/agent/nodes/fetch_schema.py` — introspection SQLAlchemy
5. `backend/agent/nodes/generate_sql.py` — prompt Gemini + dialecte + schéma
6. `backend/agent/nodes/validate_sql.py` — read-only check + syntaxe
7. `backend/agent/nodes/execute_query.py` — exécution + gestion erreur
8. `backend/agent/nodes/retry.py` — boucle reformulation (max 3)
9. `backend/agent/nodes/translate.py` — traduction résultat → naturel
10. `backend/agent/nodes/clarify.py` — détection ambiguïté
11. `backend/agent/graph.py` — assemblage du graph LangGraph
12. `backend/main.py` — endpoints FastAPI
13. Frontend React (ChatWindow + QueryInput + SqlDebugPanel)
14. `docker-compose.yml` + `Dockerfile` backend + `Dockerfile` frontend
15. `start.bat`

---

## Conventions de code

- **Python** : PEP 8, type hints partout, fonctions async pures dans les nœuds
- **TypeScript** : strict mode activé, pas de `any`
- **Nœuds LangGraph** : chaque nœud prend `state: AgentState` et retourne `dict`
- **Pas de SQL hardcodé** : tout SQL est généré par le LLM ou via SQLAlchemy ORM
- **Logging** : `logging.info()` à chaque transition de nœud

---

## Ce que ce projet N'est PAS

- ❌ Pas d'écriture en base (INSERT/UPDATE/DELETE) — read-only uniquement
- ❌ Pas d'authentification utilisateur (hors scope MVP)
- ❌ Pas de support multi-DB simultané (une seule DATABASE_URL à la fois)
- ❌ Pas de sauvegarde de l'historique entre sessions (mémoire locale seulement)
