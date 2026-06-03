# WEBtoPDF — Application de conversion agentique

Application web complète qui convertit des fichiers dans les deux sens :

- **Mode A** : HTML/CSS → PDF (rendu via Puppeteer)
- **Mode B** : PDF → HTML/CSS (reconstruction visuelle via IA multi-agents)

Le Mode B utilise une architecture **multi-agents** : chaque agent a une responsabilité unique, et une boucle de validation visuelle (screenshot → Gemini vision → score) itère jusqu'à atteindre 90 % de similarité avec le document original.

---

## Sommaire

- [Architecture agentique](#architecture-agentique)
- [Pipeline Mode A — HTML/CSS → PDF](#pipeline-mode-a--htmlcss--pdf)
- [Pipeline Mode B — PDF → HTMLCSS](#pipeline-mode-b--pdf--htmlcss)
- [Description des agents](#description-des-agents)
- [Temps réel — JobStore & SSE](#temps-réel--jobstore--sse)
- [Stack technique](#stack-technique)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Lancement](#lancement)
- [Dépendances](#dépendances)

---

## Architecture agentique

```
Requête HTTP
     │
     ▼
 Orchestrateur
     │
     ├─ planningAgent    ← analyse la structure du document
     ├─ parserAgent      ← extrait le texte avec positions x/y
     ├─ screenshotAgent  ← rend chaque page en image PNG
     ├─ layoutAgent      ← reconstruit le squelette visuel (sans texte)
     ├─ textAgent        ← injecte le vrai texte dans le layout
     └─ validatorAgent   ← compare visuellement, génère les corrections
              │
              └─ boucle (max 10 retries) jusqu'à score ≥ 90 %
```

Chaque agent est une fonction `async (ctx) → ctx`. Ils se passent un objet `ctx` (contexte du job) qui accumule les résultats au fil du pipeline.

---

## Pipeline Mode A — HTML/CSS → PDF

```
[POST /convert?mode=html-to-pdf]
         │
         ▼
  planningAgent      → détecte les fichiers HTML/CSS uploadés
         │
         ▼
  rendererAgent      → lance Puppeteer (headless Chrome) → génère le PDF
         │
         ▼
  qaAgent            → vérifie que le PDF n'est pas vide (taille, pages)
         │
         ├─ OK  → retourne le PDF
         │
         └─ KO  → repairAgent → Gemini corrige le CSS (@page, page-break)
                      └─ retry rendererAgent + qaAgent (max 8 fois)
```

---

## Pipeline Mode B — PDF → HTML/CSS

```
[POST /convert?mode=pdf-to-html]
         │
         ▼
  planningAgent      → analyse la structure visuelle via pdfjs-dist
                        (nombre de colonnes, frontière, tailles de police)
         │
         ▼
  parserAgent        → extrait le texte avec positions x/y par page
                        (groupé par colonne gauche/droite, titres/body)
         │
         ▼
  screenshotAgent    → rend chaque page PDF sur un <canvas> via pdfjs
                        → screenshot PNG de chaque page (référence visuelle)
         │
         ▼
  layoutAgent        → envoie les screenshots à Gemini vision
                        → génère le squelette HTML/CSS avec PLACEHOLDERS
                        → [HEADING], [LABEL], [BODY TEXT], [NAME]...
                        → focus : layout, couleurs, colonnes, fonts
         │
         ▼
  textAgent          → reçoit layout + texte extrait + screenshots
                        → Gemini place le vrai texte aux bons endroits
                        → remplace les placeholders par le contenu réel
         │
         ▼
  validatorAgent     → screenshot du HTML rendu (même dimensions que le PDF)
                        → compare avec screenshot PDF via Gemini vision
                        → score 0–100 + liste de corrections précises
         │
         ├─ score ≥ 90 % → retourne le HTML/CSS ✅
         │
         └─ score < 90 % → corrections envoyées à textAgent → retry
                   │
                   └─ si score < 50 % après 1 retry → layoutAgent repart
                       de zéro (le layout lui-même est refait)
```

---

## Description des agents

### `planningAgent`
Analyse le premier fichier PDF avec `pdfjs-dist` pour détecter :
- Le nombre de pages
- La présence d'une mise en page multi-colonnes (détection du gap horizontal dans les positions x des blocs de texte)
- La frontière entre les colonnes (en pixels)
- Le seuil de taille de police pour distinguer titres et texte courant

### `parserAgent`
Extrait tout le texte du PDF page par page via `pdfjs-dist`, avec les coordonnées x/y de chaque bloc. Groupe les blocs :
- Par colonne (gauche si `x < frontière`, droite sinon)
- Par ligne (même y ± 3pt)
- Par type (titre si `fontSize ≥ seuil`, sinon body)

Produit un objet `structuredContent` hiérarchisé utilisé par `textAgent`.

### `screenshotAgent`
Lance un navigateur Puppeteer headless. Charge `pdfjs-dist` depuis le serveur Express (`/pdfjs/...`) dans une page HTML, rend chaque page PDF sur un `<canvas>`, puis prend un screenshot PNG. Ces images servent de **référence visuelle** pour `layoutAgent`, `textAgent` et `validatorAgent`.

### `layoutAgent`
Envoie les screenshots PDF à **Gemini 2.5 Flash** (multimodal) avec la consigne : *reproduire la structure visuelle en HTML/CSS, sans le vrai texte — utiliser des placeholders*. L'agent se concentre sur :
- La structure de colonnes (flexbox/grid)
- Les couleurs (fond, texte, titres, bordures)
- Les tailles et graisses de police (hiérarchie visuelle)
- L'espacement et les marges

### `textAgent`
Reçoit le squelette HTML/CSS du `layoutAgent`, le texte structuré du `parserAgent`, et les screenshots PDF. Demande à Gemini de remplacer les placeholders par le vrai contenu, en se basant sur les screenshots pour savoir *quel texte va où*. En cas de retry, reçoit également la liste de corrections du `validatorAgent`.

### `validatorAgent`
1. Rend le HTML/CSS dans Puppeteer avec un viewport calé sur les dimensions exactes de la page PDF
2. Prend un screenshot du rendu HTML
3. Envoie les deux images (PDF original + HTML rendu) à Gemini vision
4. Gemini retourne un **score 0–100** et une **liste de corrections précises** (ex : `"Left sidebar background should be #1e2b3c, currently white"`)
5. Si `score < threshold` → corrections transmises à `textAgent` pour un nouveau cycle

### `repairAgent` *(Mode A uniquement)*
Utilisé quand le PDF généré par Puppeteer échoue la validation QA. Envoie les erreurs et le CSS original à Gemini qui génère un CSS de correction ciblé sur les problèmes de `@page`, `page-break`, et layout d'impression.

### `qaAgent` *(Mode A uniquement)*
Vérifie que le PDF généré n'est pas vide (taille minimale en octets, accessibilité du fichier).

---

## Temps réel — JobStore & SSE

La conversion peut durer **30 secondes à 3 minutes** selon le nombre de pages et de retries. Pour éviter que le navigateur attende en silence :

1. `POST /convert` retourne immédiatement un `{ jobId }` et lance le traitement en arrière-plan
2. Le frontend ouvre une connexion **Server-Sent Events** sur `GET /status/:jobId`
3. Chaque action des agents émet un message en temps réel :

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

Le `jobStore` est un bus d'événements en mémoire (`Map`) qui stocke les messages et les diffuse à tous les clients SSE connectés. Les jobs sont supprimés automatiquement 2 minutes après leur fin.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Runtime | Node.js 20 (Alpine) |
| Web framework | Express 5 |
| PDF rendering | Puppeteer-core + Chromium |
| PDF parsing | pdfjs-dist 3.x + pdf-parse |
| LLM / Vision | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Temps réel | Server-Sent Events (SSE natif) |
| Frontend | Vanilla HTML/CSS/JS |
| Conteneurisation | Docker Compose |

---

## Installation

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et démarré
- Une clé API Google Gemini ([Google AI Studio](https://aistudio.google.com/))

### 1. Cloner / récupérer le projet

```bash
git clone <repo-url>
cd WEBtoPDF
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Ouvrir `.env` et renseigner la clé API :

```env
GEMINI_API_KEY=your_key_here
```

### 3. Lancer l'application

**Windows** — double-cliquer sur `start.bat`

**Linux / macOS** :
```bash
docker compose up --build
```

L'application est disponible sur **http://localhost:3002**

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | Clé API Google Gemini (obligatoire) |
| `PORT` | `3002` | Port d'écoute du serveur |
| `MAX_RETRIES` | `8` | Nombre maximum de tentatives de correction |
| `UPLOAD_SIZE_LIMIT` | `50mb` | Taille maximale des fichiers uploadés |
| `VISUAL_SIMILARITY_THRESHOLD` | `90` | Score minimum (0–100) pour valider le résultat |

---

## Lancement

```bash
# Démarrer (avec rebuild de l'image)
docker compose up --build

# Démarrer sans rebuild (plus rapide si le code n'a pas changé)
docker compose up

# Arrêter
docker compose down

# Voir les logs en temps réel
docker compose logs -f
```

---

## Dépendances

Ce projet est **Node.js**. Le fichier `backend/package.json` est l'équivalent d'un `requirements.txt` Python — il liste toutes les dépendances npm.

### Dépendances applicatives (`backend/package.json`)

| Package | Version | Rôle |
|---|---|---|
| `express` | ^5.0.0 | Serveur web, routing, SSE |
| `multer` | ^1.4.5-lts.1 | Upload de fichiers multipart |
| `puppeteer-core` | ^22.0.0 | Pilotage de Chromium (rendu PDF, screenshots) |
| `@google/generative-ai` | ^0.21.0 | SDK Gemini (vision, génération JSON) |
| `pdf-parse` | ^1.1.1 | Extraction de texte brut depuis PDF |
| `pdfjs-dist` | ^3.11.174 | Extraction de texte positionné + rendu canvas |
| `uuid` | ^9.0.0 | Génération d'identifiants uniques (jobs, fichiers) |

### Dépendances système (installées via Docker / Alpine)

| Package | Rôle |
|---|---|
| `chromium` | Navigateur headless utilisé par Puppeteer |

Ces dépendances système sont gérées automatiquement dans le `Dockerfile` — aucune installation manuelle nécessaire.

### Installation des dépendances npm (hors Docker)

Si tu veux faire tourner le backend hors Docker :

```bash
cd backend
npm install
node src/index.js
```

> **Note** : hors Docker, Chromium doit être installé séparément sur le système, et `PUPPETEER_EXECUTABLE_PATH` doit pointer vers son exécutable.
