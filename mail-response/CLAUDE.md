# CLAUDE.md — Agent Email Customer Response

## Vue d'ensemble du projet

Application agentique de réponse automatique aux emails clients.  
Le système analyse les emails entrants, identifie l'expéditeur, extrait les intentions,
génère une réponse adaptée et soumet le brouillon à validation humaine avant envoi.

---

## Règle absolue de communication

**Toutes les réponses générées par l'agent — emails clients, messages de confirmation,
demandes de clarification — doivent impérativement utiliser le vouvoiement.**  
Aucune exception, même si l'expéditeur tutoie dans son message.

Exemples :
- ✅ "Nous vous confirmons votre rendez-vous…"
- ✅ "Pourriez-vous nous préciser…"
- ✅ "Nous vous remercions de votre message…"
- ❌ "On te confirme…" / "Tu peux nous envoyer…"

---

## Architecture du pipeline agentique

```
[0] Triage & classification
      ↓
[1] Sélection email + conversion texte brut
      ↓
[2] Identification expéditeur (mémoire vectorielle ChromaDB)
      ↓
[2b] Ajout en mémoire si expéditeur inconnu
      ↓
[3] Extraction structurée : intent + entités + infos manquantes
      ↓
[3b] Si infos manquantes → générer email de clarification
      ↓
[4] Sélection template + tone matching + contraintes métier
      ↓
[5] Génération de la réponse (Gemini 2.5)
      ↓
[6] Review humaine dans l'interface web (diff + régénération)
      ↓
[7] Envoi + mise à jour mémoire + tâches de suivi
```

---

## Stack technique

| Composant         | Technologie                              |
|-------------------|------------------------------------------|
| Orchestration     | Python + LangGraph                       |
| LLM               | Google Gemini 2.5 (`gemini-2.5-flash`)   |
| Mémoire           | ChromaDB + embeddings `all-MiniLM-L6-v2` |
| Interface         | FastAPI + React (page web)               |
| Email             | Gmail API (OAuth2)                       |
| Containerisation  | Docker + Docker Compose                  |
| Lancement Windows | `start.bat`                              |

---

## Structure du projet

```
email-agent/
├── CLAUDE.md
├── .env                        # Variables d'environnement (ne pas commiter)
├── .env.example
├── docker-compose.yml
├── start.bat                   # Wrapper Windows double-clic → exécute start.sh dans WSL
├── start.sh                    # Lanceur réel (build + up + ouverture navigateur)
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # Entrée FastAPI
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── pipeline.py         # Orchestration LangGraph
│   │   ├── nodes/
│   │   │   ├── triage.py       # Étape 0 : classification
│   │   │   ├── fetch_email.py  # Étape 1 : récupération Gmail
│   │   │   ├── identify.py     # Étape 2 : identification expéditeur
│   │   │   ├── extract.py      # Étape 3 : extraction intent/entités
│   │   │   ├── generate.py     # Étapes 4-5 : génération réponse
│   │   │   └── followup.py     # Étape 7 : post-envoi
│   │   └── prompts/
│   │       ├── triage.txt
│   │       ├── extract.txt
│   │       ├── generate.txt
│   │       └── tone.txt
│   ├── memory/
│   │   ├── chroma_client.py    # Client ChromaDB
│   │   └── contacts.py         # CRUD contacts mémoire
│   ├── gmail/
│   │   ├── auth.py             # OAuth2 Gmail
│   │   ├── reader.py           # Lecture emails
│   │   └── sender.py           # Envoi emails
│   └── models/
│       ├── email_model.py
│       ├── contact.py
│       └── intent.py
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── Inbox.tsx       # Liste emails à traiter
│       │   └── Review.tsx      # Validation brouillon
│       └── components/
│           ├── EmailCard.tsx
│           ├── DiffViewer.tsx  # Comparaison email reçu / réponse
│           └── ContactBadge.tsx
│
├── chromadb/
│   └── (données persistées via volume Docker)
│
└── credentials/
    ├── gmail_credentials.json  # OAuth2 (ne pas commiter)
    └── token.json              # Généré au premier lancement
```

---

## Variables d'environnement (`.env`)

```env
# LLM
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Gmail
GMAIL_USER=your@gmail.com

# App — ports exposés sur la machine hôte (changez-les si déjà utilisés)
BACKEND_PORT=8000
FRONTEND_PORT=3000
CHROMA_PORT=8001
LOG_LEVEL=INFO
```

---

## `docker-compose.yml`

```yaml
services:
  backend:
    build: ./backend
    container_name: email_agent_backend
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    volumes:
      - ./credentials:/app/backend/credentials
      - chromadb_data:/app/backend/chromadb
    env_file:
      - .env
    restart: unless-stopped
    depends_on:
      - chromadb

  frontend:
    build: ./frontend
    container_name: email_agent_frontend
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    environment:
      - VITE_API_URL=http://localhost:${BACKEND_PORT:-8000}
    restart: unless-stopped

  chromadb:
    image: chromadb/chroma:latest
    container_name: email_agent_chroma
    volumes:
      - chromadb_data:/chroma/chroma
    ports:
      - "${CHROMA_PORT:-8001}:8000"
    restart: unless-stopped

volumes:
  chromadb_data:
```

> Le bind-mount du code source (`./backend:/app`) a été **retiré** : lancé depuis
> Windows sur un chemin WSL, Docker Desktop corrompt le bind et masque le code.
> Le code de l'image (copié sous `/app/backend`) est donc toujours utilisé.

---

## Lancement — `start.bat` + `start.sh`

Le projet vit sur le système de fichiers WSL (`\\wsl.localhost\…`). Lancer Docker
directement depuis Windows corromprait les chemins (bind mounts → `Z:\…` vides).
Pour éviter ça, **`start.bat` n'est qu'un wrapper** : il convertit le chemin du
projet en chemin Linux puis exécute le vrai lanceur **`start.sh` dans WSL**, où
Docker s'exécute avec des chemins corrects.

- **`start.sh`** (lanceur réel, exécuté dans WSL) : vérifie Docker + `.env`, lance
  `docker compose up -d --build`, lit `FRONTEND_PORT` dans `.env`, puis ouvre le
  navigateur Windows via `explorer.exe`.
- **`start.bat`** (Windows double-clic) : reconstruit le chemin Linux du projet à
  partir de `%~dp0` (retire le préfixe `\\wsl.localhost\<distro>\`, convertit les
  `\` en `/`) et appelle `wsl -e bash -lc "'<chemin>/start.sh'"`.

> Prérequis : WSL + intégration WSL de Docker Desktop. Sous Linux/macOS, lancer
> directement `./start.sh`.

---

## Conventions de code

### Python (backend)
- **Style** : PEP8, type hints obligatoires, docstrings sur toutes les fonctions publiques
- **Async** : FastAPI + `async/await` partout
- **LangGraph** : chaque nœud du pipeline = fonction pure `(state: AgentState) -> AgentState`
- **Prompts** : externalisés dans `agent/prompts/*.txt`, jamais en dur dans le code
- **Structured output** : toujours utiliser Pydantic pour les réponses LLM structurées

### TypeScript (frontend)
- **Style** : ESLint + Prettier
- **Composants** : fonctionnels uniquement, hooks React
- **State** : Zustand pour l'état global
- **API calls** : React Query (`@tanstack/react-query`)

### Git
- Branches : `feat/`, `fix/`, `refactor/`, `docs/`
- Commits : conventionnel (`feat:`, `fix:`, `docs:`, etc.)
- Ne jamais commiter `.env`, `credentials/`, `token.json`

---

## Modèle de state LangGraph

```python
class AgentState(TypedDict):
    # Email source
    email_id: str
    email_raw: str
    email_parsed: dict          # {from, subject, body, date}

    # Classification
    email_type: str             # rdv / reclamation / info / spam / hors_scope
    priority: str               # urgent / normal / low
    requires_human: bool

    # Contact
    contact: dict | None        # Infos expéditeur depuis mémoire
    is_new_contact: bool

    # Extraction
    intent: str
    entities: dict              # date, service, montant, etc.
    missing_info: list[str]

    # Génération
    template_id: str
    draft_response: str
    tone: str                   # formel / semi-formel

    # Review
    human_approved: bool
    human_edits: str | None

    # Post-envoi
    sent: bool
    followup_task: dict | None
```

---

## Endpoints API principaux

| Méthode | Route                      | Description                        |
|---------|----------------------------|------------------------------------|
| GET     | `/emails/inbox`            | Liste les emails non traités       |
| POST    | `/emails/{id}/process`     | Lance le pipeline sur un email     |
| GET     | `/emails/{id}/draft`       | Récupère le brouillon généré       |
| POST    | `/emails/{id}/approve`     | Valide et envoie le brouillon      |
| POST    | `/emails/{id}/regenerate`  | Régénère avec instruction          |
| GET     | `/contacts`                | Liste les contacts en mémoire      |
| GET     | `/contacts/{id}`           | Détail d'un contact + historique   |

---

## Sécurité

- La clé `GEMINI_API_KEY` ne doit **jamais** apparaître dans les logs ni dans le frontend
- Le token OAuth2 Gmail (`token.json`) est monté en volume, hors du code source
- ChromaDB n'est pas exposé en dehors du réseau Docker (`ports` pour debug uniquement)
- En production : supprimer l'exposition du port ChromaDB du `docker-compose.yml`

---

## Premier lancement — checklist

- [ ] Copier `.env.example` → `.env` et renseigner `GEMINI_API_KEY` et `GMAIL_USER`
- [ ] Placer `gmail_credentials.json` (type **OAuth client desktop / "installed"**) dans `credentials/` (depuis Google Cloud Console)
- [ ] Lancer `start.bat` (Windows) ou `docker compose up --build` (Linux/Mac)
- [ ] **Autoriser Gmail une seule fois** (voir section ci-dessous) — sans ça, l'inbox renvoie une erreur 500 « Autorisation Gmail requise »
- [ ] L'interface est disponible sur `http://localhost:3000` (défaut ; `3004` dans cet environnement via `.env`)

---

## Autorisation OAuth2 Gmail (étape unique)

L'autorisation Gmail ne peut **pas** se faire automatiquement : le conteneur Docker
n'a pas de navigateur, et le flux OAuth « installed app » exige une connexion
interactive au compte Google. Cette étape est donc **manuelle et unique** — une fois
le `token.json` généré, il est réutilisé (refresh automatique) sans navigateur.

### Procédure

1. Depuis le dossier du projet, lancer le script d'autorisation dédié
   (`backend/gmail/authorize.py`), avec le port `8765` publié :

   ```bash
   docker compose run --rm -p 8765:8765 backend python -m backend.gmail.authorize
   ```

2. Le script affiche une **URL** — l'ouvrir dans le navigateur de l'hôte.
3. Se connecter au compte Gmail (`GMAIL_USER`) et autoriser l'accès.
4. Le `token.json` est écrit dans `credentials/` (monté en volume → persistant).
5. Relancer l'application (`start.bat` ou `docker compose up -d`).

### Points importants

- Le compte doit être ajouté dans **Utilisateurs de test** de l'écran de consentement
  OAuth (Google Cloud Console) tant que l'app est en mode « test », sinon Google bloque.
- À l'exécution normale, `gmail/auth.py` ne tente **jamais** d'ouvrir un navigateur :
  si le token est absent/invalide et non rafraîchissable, il lève une erreur explicite
  rappelant la commande ci-dessus.
- Ne **jamais** commiter `credentials/token.json` ni `credentials/gmail_credentials.json`
  (déjà couverts par `.gitignore`).

---

## Notes de déploiement (Docker)

- **Ports** : `BACKEND_PORT` (défaut `8000`), `FRONTEND_PORT` (défaut `3000`) et
  `CHROMA_PORT` (défaut `8001`) sont configurables dans `.env`. Dans cet environnement :
  `8002` / `3004` car `8000`/`8001`/`3000` sont pris par d'autres projets. Le frontend
  dérive son `VITE_API_URL` de `BACKEND_PORT`.
- **Code source dans l'image** : le code backend est copié dans l'image sous `/app/backend`
  (et `PYTHONPATH=/app`, d'où les imports `from backend.xxx`). Le bind-mount du code source
  a été **retiré** volontairement : lancé depuis Windows sur un chemin WSL (`\\wsl.localhost\…`),
  Docker Desktop corrompt le chemin du bind et masque le code par un dossier vide. Sans mount,
  le code de l'image est toujours utilisé → comportement identique depuis Windows et WSL.
  Conséquence : pas de hot-reload ; après modification du backend, faire `docker compose build backend`.
- **Lancement** : `start.bat` est un wrapper Windows qui reconstruit le chemin Linux
  du projet et exécute `start.sh` **dans WSL** (`wsl -e bash -lc`), pour que Docker
  tourne avec des chemins corrects (bind mounts credentials/chromadb intacts). Sous
  Linux/WSL, lancer directement `./start.sh`.
