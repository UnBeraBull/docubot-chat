#!/usr/bin/env bash
# One-shot bootstrap for a fresh Ubuntu/Debian VPS.
# Idempotent: safe to re-run after editing .env or adding docs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# sudo helper (skip when already root)
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m!! %s\033[0m\n" "$*"; }
die() { printf "\n\033[1;31mxx %s\033[0m\n" "$*" >&2; exit 1; }

# 1. OS check
if ! command -v apt-get >/dev/null 2>&1; then
  die "This bootstrap supports Debian/Ubuntu (apt-get). On other distros, install Node.js 18.17+ and pm2 manually, then run: npm install && npm run index && npm start"
fi

# 2. Node.js 20 LTS (skip if >= 18.17 already present)
need_node=1
if command -v node >/dev/null 2>&1; then
  ver="$(node -v | sed 's/^v//')"
  major="${ver%%.*}"
  rest="${ver#*.}"; minor="${rest%%.*}"
  if [ "$major" -gt 18 ] || { [ "$major" -eq 18 ] && [ "$minor" -ge 17 ]; }; then
    say "Node.js $ver already installed — skipping install."
    need_node=0
  fi
fi
if [ "$need_node" -eq 1 ]; then
  say "Installing Node.js 20 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi

# 3. pm2
if ! command -v pm2 >/dev/null 2>&1; then
  say "Installing pm2 globally..."
  $SUDO npm install -g pm2
else
  say "pm2 already installed — skipping."
fi

# 4. npm install
say "Installing project dependencies..."
npm install

# 5. .env check
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created from .env.example."
  warn "Edit it now and fill in TELEGRAM_BOT_TOKEN and GROQ_API_KEY, then re-run ./bootstrap.sh"
  exit 0
fi

# 6. Docs check (respect DOCS_DIR from .env, default ./docs)
DOCS_DIR_VAL="$(grep -E '^DOCS_DIR=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
DOCS_DIR_VAL="${DOCS_DIR_VAL:-./docs}"
mkdir -p "$DOCS_DIR_VAL"
if ! find "$DOCS_DIR_VAL" -type f \( -iname '*.md' -o -iname '*.mdx' \) | grep -q .; then
  warn "No .md files found in $DOCS_DIR_VAL"
  warn "Drop your documentation .md files into that folder, then re-run ./bootstrap.sh"
  exit 0
fi

# 7. Build the vector index
say "Building vector index (first run downloads ~80 MB embedding model)..."
npm run index

# 8. Start / restart under pm2
if pm2 describe docs-bot >/dev/null 2>&1; then
  say "Restarting docs-bot under pm2..."
  pm2 restart docs-bot --update-env
else
  say "Starting docs-bot under pm2..."
  pm2 start src/index.js --name docs-bot
fi
pm2 save

# 9. Next steps
cat <<EOF

\033[1;32mAll done.\033[0m

Useful commands:
  pm2 logs docs-bot       # tail bot logs
  pm2 restart docs-bot    # restart after editing .env
  pm2 startup             # follow the printed command to enable boot-start

After editing or adding .md files:
  ./bootstrap.sh          # rebuilds the index and restarts the bot

EOF
