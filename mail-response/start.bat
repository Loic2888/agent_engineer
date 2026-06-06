@echo off
pushd "%~dp0"
title Email Agent - Demarrage
color 0A

echo ============================================
echo   EMAIL AGENT - Lancement de l'application
echo ============================================
echo.

REM Verification Docker Desktop
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Docker Desktop n'est pas lance.
    echo Veuillez demarrer Docker Desktop puis relancer ce fichier.
    popd
    pause
    exit /b 1
)

REM Verification fichier .env
if not exist ".env" (
    echo [ERREUR] Fichier .env manquant.
    echo Copiez .env.example en .env et renseignez vos cles API.
    popd
    pause
    exit /b 1
)

echo [1/3] Construction des images Docker (peut prendre plusieurs minutes)...
docker compose build
if %errorlevel% neq 0 (
    echo [ERREUR] La construction a echoue.
    popd
    pause
    exit /b 1
)

echo.
echo [2/3] Demarrage des conteneurs...
docker compose up -d
if %errorlevel% neq 0 (
    echo [ERREUR] Le demarrage a echoue.
    popd
    pause
    exit /b 1
)

echo.
echo [3/3] Attente de disponibilite...
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   Application disponible :
echo   Frontend  : http://localhost:3004
echo   Backend   : http://localhost:8002
echo   API Docs  : http://localhost:8002/docs
echo ============================================
echo.
echo Appuyez sur une touche pour ouvrir le navigateur...
pause >nul

start http://localhost:3004
popd
