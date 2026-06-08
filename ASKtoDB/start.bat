@echo off
echo Demarrage de ASKtoDB...
docker-compose up -d
echo.
echo En attente du demarrage des services...
timeout /t 4 /nobreak > nul
start http://localhost:3005
echo Application lancee : http://localhost:3005
pause
