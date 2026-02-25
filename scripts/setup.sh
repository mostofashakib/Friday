#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Friday — First-Time Setup Script
# Installs all dependencies and interactively configures .env files.
# Safe to re-run — skips steps that are already done.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

log()    { echo -e "\n${BOLD}▸ $*${RESET}"; }
ok()     { echo -e "  ${GREEN}✓${RESET} $*"; }
warn()   { echo -e "  ${YELLOW}⚠${RESET} $*"; }
err()    { echo -e "  ${RED}✗${RESET} $*"; }
prompt() { echo -e "  ${CYAN}?${RESET} $*"; }
dim()    { echo -e "  ${DIM}$*${RESET}"; }

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║       Friday — First-Time Setup          ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── Helper: read a secret (masked) ───────────────────────────────────────────
read_secret() {
  local __var="$1"
  local __prompt="$2"
  local value=""
  echo -ne "  ${CYAN}?${RESET} ${__prompt}: "
  read -rs value
  echo ""
  eval "$__var='$value'"
}

read_value() {
  local __var="$1"
  local __prompt="$2"
  local __default="${3:-}"
  local value=""
  if [[ -n "$__default" ]]; then
    echo -ne "  ${CYAN}?${RESET} ${__prompt} ${DIM}[${__default}]${RESET}: "
  else
    echo -ne "  ${CYAN}?${RESET} ${__prompt}: "
  fi
  read -r value
  if [[ -z "$value" && -n "$__default" ]]; then
    value="$__default"
  fi
  eval "$__var='$value'"
}

# ── Step 1: Check prerequisites ───────────────────────────────────────────────
log "Checking prerequisites"

check_tool() {
  local tool="$1"
  local min_version="$2"
  local install_hint="$3"
  if command -v "$tool" &>/dev/null; then
    ok "$tool found ($(${tool} --version 2>&1 | head -1))"
  else
    err "$tool not found. Install: $install_hint"
    MISSING_TOOLS=true
  fi
}

MISSING_TOOLS=false
check_tool python3   "3.11"  "https://python.org"
check_tool node      "18"    "https://nodejs.org"
check_tool npm       "9"     "bundled with Node"
check_tool git       ""      "https://git-scm.com"

# Optional tools (needed for deploy, not dev)
echo ""
dim "Optional (needed for deployment):"
command -v vercel  &>/dev/null && ok "vercel CLI found"  || warn "vercel CLI not found — install with: npm i -g vercel"
command -v gcloud  &>/dev/null && ok "gcloud CLI found"  || warn "gcloud CLI not found — install: https://cloud.google.com/sdk"
command -v docker  &>/dev/null && ok "docker found"      || warn "docker not found — needed for GCP deploy"

if [[ "$MISSING_TOOLS" == "true" ]]; then
  echo ""
  err "Some required tools are missing. Install them and re-run this script."
  exit 1
fi

# ── Step 2: Python virtual environment ───────────────────────────────────────
log "Setting up Python environment"

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  echo -n "  Creating virtual environment..."
  python3 -m venv "$BACKEND_DIR/.venv"
  echo " done"
else
  ok "Virtual environment already exists"
fi

echo -n "  Installing Python dependencies..."
"$BACKEND_DIR/.venv/bin/pip" install -q --upgrade pip
"$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
echo " done"
ok "Backend dependencies installed"

# ── Step 3: Node.js dependencies ─────────────────────────────────────────────
log "Installing frontend dependencies"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo -n "  Running npm install..."
  npm --prefix "$FRONTEND_DIR" install --silent
  echo " done"
else
  ok "node_modules already exists"
fi
ok "Frontend dependencies installed"

# ── Step 4: Backend .env configuration ───────────────────────────────────────
log "Configuring backend environment"

if [[ -f "$BACKEND_DIR/.env" ]]; then
  prompt "backend/.env already exists. Overwrite? (y/N)"
  read -r overwrite
  if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
    ok "Keeping existing backend/.env"
    SKIP_BACKEND_ENV=true
  else
    SKIP_BACKEND_ENV=false
  fi
else
  SKIP_BACKEND_ENV=false
fi

if [[ "$SKIP_BACKEND_ENV" == "false" ]]; then
  echo ""
  echo -e "  ${DIM}You'll need keys from: Anthropic, ElevenLabs, OpenAI, Supabase${RESET}"
  echo -e "  ${DIM}Leave a field blank to skip it for now (you can edit .env later)${RESET}"
  echo ""

  read_secret ANTHROPIC_API_KEY    "ANTHROPIC_API_KEY  (console.anthropic.com)"
  read_secret ELEVENLABS_API_KEY   "ELEVENLABS_API_KEY (elevenlabs.io)"
  read_secret OPENAI_API_KEY       "OPENAI_API_KEY     (platform.openai.com)"
  read_value  SUPABASE_URL         "SUPABASE_URL       (https://xxx.supabase.co)"
  read_secret SUPABASE_SERVICE_KEY "SUPABASE_SERVICE_ROLE_KEY"
  read_value  CORS_ORIGINS         "CORS_ORIGINS" "http://localhost:3000"
  read_value  MAX_TURNS            "MAX_TURNS (interview length)" "8"

  cat > "$BACKEND_DIR/.env" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}
CORS_ORIGINS=${CORS_ORIGINS}
MAX_TURNS=${MAX_TURNS}
EOF

  ok "backend/.env created"
fi

# ── Step 5: Frontend .env.local configuration ─────────────────────────────────
log "Configuring frontend environment"

if [[ -f "$FRONTEND_DIR/.env.local" ]]; then
  prompt "frontend/.env.local already exists. Overwrite? (y/N)"
  read -r overwrite_fe
  if [[ ! "$overwrite_fe" =~ ^[Yy]$ ]]; then
    ok "Keeping existing frontend/.env.local"
    SKIP_FRONTEND_ENV=true
  else
    SKIP_FRONTEND_ENV=false
  fi
else
  SKIP_FRONTEND_ENV=false
fi

if [[ "$SKIP_FRONTEND_ENV" == "false" ]]; then
  echo ""
  echo -e "  ${DIM}These values come from your Supabase project Settings → API${RESET}"
  echo ""

  # Re-use Supabase URL if we just set it
  if [[ -z "${SUPABASE_URL:-}" ]]; then
    read_value SUPABASE_URL "NEXT_PUBLIC_SUPABASE_URL (https://xxx.supabase.co)"
  else
    ok "Reusing Supabase URL: $SUPABASE_URL"
    NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
  fi

  read_secret SUPABASE_ANON_KEY "NEXT_PUBLIC_SUPABASE_ANON_KEY (anon/public key)"
  read_value  API_URL           "NEXT_PUBLIC_API_URL" "http://localhost:8000"

  cat > "$FRONTEND_DIR/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
NEXT_PUBLIC_API_URL=${API_URL}
EOF

  ok "frontend/.env.local created"
fi

# ── Step 6: Supabase schema reminder ─────────────────────────────────────────
log "Database setup"

echo ""
echo -e "  ${YELLOW}Action required:${RESET} Run the following SQL in your Supabase project."
echo -e "  ${DIM}Dashboard → SQL Editor → New Query → paste → Run${RESET}"
echo ""
echo -e "  ${CYAN}File location:${RESET} backend/db/schema.sql"
echo ""
echo "  It creates:"
echo "    • sessions          — interview sessions"
echo "    • messages          — Q&A turns with scores"
echo "    • message_embeddings — pgvector for RAG gap detection"
echo "    • competency_scores — rolling per-competency averages"
echo "    • RLS policies      — users can only access their own data"
echo "    • match_session_embeddings() — similarity search function"
echo ""

if command -v pbcopy &>/dev/null; then
  cat "$BACKEND_DIR/db/schema.sql" | pbcopy
  ok "Schema SQL copied to clipboard (macOS)"
elif command -v xclip &>/dev/null; then
  cat "$BACKEND_DIR/db/schema.sql" | xclip -selection clipboard
  ok "Schema SQL copied to clipboard (Linux)"
fi

# ── Step 7: Done ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║           Setup complete! 🎉             ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Next steps:"
echo -e "    ${GREEN}1.${RESET} Run the schema SQL in your Supabase SQL editor"
echo -e "    ${GREEN}2.${RESET} Start everything: ${BOLD}bash scripts/dev.sh${RESET}"
echo -e "    ${GREEN}3.${RESET} Open: ${CYAN}http://localhost:3000${RESET}"
echo ""
