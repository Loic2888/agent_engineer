@echo off
setlocal

:: pushd maps the UNC path (\\wsl.localhost\...) to a temporary drive letter
:: so that CMD can work with it normally
pushd "%~dp0"
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Impossible de se placer dans le repertoire du script.
    pause
    exit /b 1
)

echo ============================================
echo    Invoice Processing Agent - Demarrage
echo ============================================

:: Check Docker is available
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Docker n'est pas installe ou pas dans le PATH.
    echo Installez Docker Desktop : https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

:: Check .env exists
if not exist ".env" (
    echo [INFO] Fichier .env introuvable, creation depuis .env.example...
    copy ".env.example" ".env" >nul
    echo [ACTION REQUISE] Ouvrez le fichier .env et renseignez votre GEMINI_API_KEY.
    start notepad ".env"
    pause
    exit /b 1
)

:: Build & start with Docker Compose
echo [INFO] Construction et demarrage du conteneur...
docker compose up --build -d

if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Le demarrage Docker a echoue. Consultez les logs ci-dessus.
    pause
    exit /b 1
)

:: Wait a moment then open the browser
echo [INFO] Demarrage en cours, ouverture du navigateur...
timeout /t 3 /nobreak >nul
start http://localhost:3001

echo.
echo [OK] Application disponible sur http://localhost:3001
echo Pour arreter : docker compose down
echo.
pause

popd
