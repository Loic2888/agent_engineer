@echo off
title Deep Research Agent — Launcher
python "%~dp0setup.py"
if errorlevel 1 (
    echo.
    echo An error occurred. See message above.
    pause
)
