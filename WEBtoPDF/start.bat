@echo off
pushd "%~dp0"
echo [WEBtoPDF] Stopping existing containers...
docker compose down --remove-orphans
if errorlevel 1 (
    echo ERROR: docker compose down failed. Is Docker Desktop running?
    popd
    pause
    exit /b 1
)
echo [WEBtoPDF] Building and starting...
docker compose up --build
popd
pause
