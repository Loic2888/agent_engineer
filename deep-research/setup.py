#!/usr/bin/env python3
"""
setup.py — Deep Research Agent launcher
Double-click this file (or run: python setup.py) to build and start the app.
"""

import os
import sys
import time
import socket
import subprocess
import webbrowser
from pathlib import Path

# ── colours (Windows 10+ supports ANSI via ENABLE_VIRTUAL_TERMINAL_PROCESSING) ──
if sys.platform == "win32":
    import ctypes
    kernel32 = ctypes.windll.kernel32
    kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)

RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"

def ok(msg):   print(f"{GREEN}  ✔  {msg}{RESET}")
def info(msg): print(f"{CYAN}  ➜  {msg}{RESET}")
def warn(msg): print(f"{YELLOW}  ⚠  {msg}{RESET}")
def err(msg):  print(f"{RED}  ✖  {msg}{RESET}")
def title(msg):print(f"\n{BOLD}{CYAN}{msg}{RESET}\n")

# ── helpers ───────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.resolve()

def check_command(cmd: str) -> bool:
    """Return True if `cmd` is available on PATH."""
    try:
        subprocess.run(
            [cmd, "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def docker_is_running() -> bool:
    """Return True if the Docker daemon responds."""
    try:
        subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def port_open(host: str, port: int) -> bool:
    """Return True if a TCP connection can be made to host:port."""
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def wait_for_port(host: str, port: int, label: str, timeout: int = 120) -> bool:
    """Block until the port is open or timeout is reached."""
    info(f"Waiting for {label} (port {port}) …")
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_open(host, port):
            ok(f"{label} is ready")
            return True
        time.sleep(2)
    err(f"{label} did not respond within {timeout}s")
    return False


# ── pre-flight checks ─────────────────────────────────────────────────────────

def preflight():
    title("=== Deep Research Agent — pre-flight checks ===")

    if not check_command("docker"):
        err("Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/")
        sys.exit(1)
    ok("docker found")

    if not docker_is_running():
        err("Docker daemon is not running. Start Docker Desktop and try again.")
        sys.exit(1)
    ok("Docker daemon is running")

    env_file = ROOT / ".env"
    if not env_file.exists():
        warn(".env not found — copying from .env.example")
        example = ROOT / ".env.example"
        if example.exists():
            env_file.write_text(example.read_text())
            warn("Edit .env and fill in your API keys before using the app.")
        else:
            err(".env.example not found either. Create .env manually.")
            sys.exit(1)
    else:
        # quick check that required keys are not empty
        content = env_file.read_text()
        missing = [
            k for k in ("GEMINI_API_KEY", "TAVILY_API_KEY")
            if f"{k}=" not in content or f"{k}=\n" in content or f"{k}=$" in content
        ]
        if missing:
            warn(f"These keys look empty in .env: {', '.join(missing)}")
        else:
            ok(".env present with API keys")


# ── docker compose ─────────────────────────────────────────────────────────────

def compose_up():
    title("=== Building and starting containers ===")
    info("Running: docker compose up --build -d")
    print()

    result = subprocess.run(
        ["docker", "compose", "up", "--build", "-d"],
        cwd=ROOT,
    )
    if result.returncode != 0:
        err("docker compose up failed (see output above).")
        sys.exit(result.returncode)

    ok("Containers started")


# ── health checks ──────────────────────────────────────────────────────────────

def wait_for_services():
    title("=== Waiting for services to be healthy ===")

    backend_ok  = wait_for_port("localhost", 8000, "Backend  (FastAPI)")
    frontend_ok = wait_for_port("localhost", 80,   "Frontend (Nginx) ")

    if not backend_ok or not frontend_ok:
        err("One or more services failed to start. Run:  docker compose logs -f")
        sys.exit(1)


# ── open browser ───────────────────────────────────────────────────────────────

def open_browser():
    url = "http://localhost"
    title(f"=== Opening {url} ===")
    webbrowser.open(url)
    ok("Browser launched")


# ── tail logs ─────────────────────────────────────────────────────────────────

def stream_logs():
    print()
    print(f"{BOLD}App is running at http://localhost{RESET}")
    print(f"{BOLD}Backend API  at http://localhost:8000{RESET}")
    print()
    print("Press  Ctrl+C  to stop streaming logs (containers keep running).")
    print("To stop all containers:  docker compose down")
    print()

    try:
        subprocess.run(
            ["docker", "compose", "logs", "-f", "--tail=50"],
            cwd=ROOT,
        )
    except KeyboardInterrupt:
        print()
        info("Log stream stopped. Containers are still running.")
        info("Stop them with:  docker compose down")


# ── entry point ────────────────────────────────────────────────────────────────

def main():
    try:
        preflight()
        compose_up()
        wait_for_services()
        open_browser()
        stream_logs()
    except KeyboardInterrupt:
        print()
        info("Interrupted by user.")

    # keep the window open when double-clicked on Windows
    if sys.platform == "win32" and "PROMPT" not in os.environ:
        input("\nPress Enter to close…")


if __name__ == "__main__":
    main()
