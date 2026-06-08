#!/usr/bin/env bash
# Lanceur réel (exécuté dans WSL). Garantit des chemins Docker corrects
# (bind mounts + build context) car les fichiers du projet sont sur le FS WSL.
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  EMAIL AGENT - Demarrage"
echo "============================================"

if ! docker info >/dev/null 2>&1; then
  echo "[ERREUR] Docker n'est pas accessible. Demarrez Docker Desktop."
  exit 1
fi

if [ ! -f .env ]; then
  echo "[ERREUR] Fichier .env manquant. Copiez .env.example en .env et renseignez vos cles."
  exit 1
fi

echo "[1/2] Construction et demarrage des conteneurs..."
docker compose up -d --build

# Port frontend depuis .env (defaut 3000)
FRONTEND_PORT="$(grep -E '^FRONTEND_PORT=' .env | cut -d= -f2 | tr -d '[:space:]')"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
URL="http://localhost:${FRONTEND_PORT}"

echo "[2/2] Attente de disponibilite..."
sleep 5

# Ouvre le navigateur Windows depuis WSL.
# Note : explorer.exe renvoie un code != 0 meme en cas de succes,
# donc on ignore son code de retour et on ne chaine PAS de fallback
# (sinon une 2e page s'ouvre).
explorer.exe "$URL" >/dev/null 2>&1 || true

echo
echo "Application disponible : $URL"
