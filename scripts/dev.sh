#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Friday — Local Development Runner
# Starts backend (FastAPI/uvicorn on :8000) and frontend (Next.js on :3000)
# together. Ctrl+C gracefully stops both.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${BOLD}[friday]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓${RESET} $*"; }
warn() { echo -e "${YELLOW}  ⚠${RESET} $*"; }
err()  { echo -e "${RED}  ✗${RESET} $*"; }

# ── Prefixed log streams ──────────────────────────────────────────────────────
backend_log()  { while IFS= read -r line; do echo -e "${CYAN}[backend] ${RESET}$line"; done; }
frontend_log() { while IFS= read -r line; do echo -e "${GREEN}[frontend]${RESET} $line"; done; }

# ── Cleanup on exit ───────────────────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  log "Shutting down..."
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null && ok "Backend stopped"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend stopped"
  # Kill any stragglers on the ports
  lsof -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# ── Preflight checks ─────────────────────────────────────────────────────────
log "Running preflight checks..."

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  err "backend/.env not found. Run: bash scripts/setup.sh"
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
  err "frontend/.env.local not found. Run: bash scripts/setup.sh"
  exit 1
fi

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  warn "No Python venv found — creating one now..."
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  warn "node_modules missing — running npm install..."
  npm --prefix "$FRONTEND_DIR" install --silent
fi

# ── Check ports are free ─────────────────────────────────────────────────────
if lsof -ti:8000 &>/dev/null; then
  warn "Port 8000 is in use. Run 'bash scripts/kill.sh' first, or it may conflict."
fi
if lsof -ti:3000 &>/dev/null; then
  warn "Port 3000 is in use. Run 'bash scripts/kill.sh' first, or it may conflict."
fi

# ── Start backend ─────────────────────────────────────────────────────────────
log "Starting backend on ${CYAN}http://localhost:8000${RESET}"
(
  source "$BACKEND_DIR/.venv/bin/activate"
  cd "$BACKEND_DIR"
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload 2>&1
) | backend_log &
BACKEND_PID=$!

# Give uvicorn a moment to start
sleep 2

# ── Start frontend ────────────────────────────────────────────────────────────
log "Starting frontend on ${GREEN}http://localhost:3000${RESET}"
(
  cd "$FRONTEND_DIR"
  npm run dev 2>&1
) | frontend_log &
FRONTEND_PID=$!

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Friday is running${RESET}"
echo -e "  ${CYAN}Backend${RESET}  → http://localhost:8000"
echo -e "  ${CYAN}API Docs${RESET} → http://localhost:8000/docs"
echo -e "  ${GREEN}Frontend${RESET} → http://localhost:3000"
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop both"
echo ""

# ── Wait ─────────────────────────────────────────────────────────────────────
wait $BACKEND_PID $FRONTEND_PID
