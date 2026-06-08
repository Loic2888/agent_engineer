@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  Lanceur Windows pour un projet stocke sur le systeme WSL.
REM  Docker est execute DANS WSL pour garder des chemins corrects
REM  (bind mounts + build context). Sinon Docker Desktop mappe le
REM  chemin en Z:\... ou /mnt/c\... et ne trouve pas les fichiers.
REM ============================================================
title Email Agent - Demarrage

set "DP=%~dp0"
if "!DP:~-1!"=="\" set "DP=!DP:~0,-1!"

REM Detecte un chemin sur le FS WSL (\\wsl.localhost\<distro>\ ou \\wsl$\<distro>\)
set "ISWSL="
echo !DP! | find /i "wsl.localhost" >nul && set "ISWSL=1"
echo !DP! | find /i "wsl$" >nul && set "ISWSL=1"

if defined ISWSL (
    REM Retire le prefixe UNC puis le nom de la distro, convertit \ en /
    set "TMP=!DP!"
    set "TMP=!TMP:\\wsl.localhost\=!"
    set "TMP=!TMP:\\wsl$\=!"
    for /f "tokens=1,* delims=\" %%a in ("!TMP!") do set "TMP=%%b"
    set "LINPATH=/!TMP:\=/!"
) else (
    REM Chemin Windows classique (C:\...) : wslpath fonctionne
    for /f "delims=" %%i in ('wsl wslpath -a "!DP!"') do set "LINPATH=%%i"
)

if "!LINPATH!"=="" (
    echo [ERREUR] Impossible de determiner le chemin WSL du projet.
    pause
    exit /b 1
)

echo Projet (WSL) : !LINPATH!
wsl -e bash -lc "'!LINPATH!/start.sh'"

echo.
pause
