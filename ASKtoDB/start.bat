@echo off
pushd "%~dp0"
echo Demarrage de ASKtoDB...

REM Lire le port frontend depuis .env (defaut 3000)
set "FRONTEND_PORT=3000"
for /f "tokens=2 delims==" %%a in ('findstr /b /i "FRONTEND_PORT=" .env 2^>nul') do set "FRONTEND_PORT=%%a"

docker-compose up -d
echo.
echo En attente du demarrage des services...
timeout /t 4 /nobreak > nul
start http://localhost:%FRONTEND_PORT%
echo Application lancee : http://localhost:%FRONTEND_PORT%
popd
pause
