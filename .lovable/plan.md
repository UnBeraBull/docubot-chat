## Add `telegram-bot/bootstrap.sh`

A one-shot script for fresh Ubuntu/Debian VPSes that installs Node.js, installs npm dependencies, and (if `.env` and docs are ready) builds the index and starts the bot under pm2.

### What the script does

1. **Detect OS** — abort with a clear message if not Debian/Ubuntu (so it doesn't silently break on RHEL/Alpine).
2. **Install Node.js 20 LTS** via NodeSource — skip if `node -v` already reports ≥ 18.17.
3. **Install pm2 globally** — skip if already installed.
4. **`npm install`** in the script's own directory (so it works no matter where the folder was unzipped).
5. **`.env` check** — if missing, copy from `.env.example` and stop with a message telling the user to fill in `TELEGRAM_BOT_TOKEN` and `GROQ_API_KEY`, then re-run.
6. **Docs check** — if `DOCS_DIR` (default `./docs`) is empty, create it and stop with a message telling the user to drop `.md` files in and re-run.
7. **Build index** — `npm run index`.
8. **Start under pm2** — `pm2 start src/index.js --name docs-bot` (or `pm2 restart` if already running), then `pm2 save`.
9. **Print next-steps** — how to view logs (`pm2 logs docs-bot`), how to enable boot-start (`pm2 startup`), and how to re-run after adding/editing docs.

### Behavior rules

- **Idempotent**: re-running is safe — re-installing deps, rebuilding the index, and restarting pm2 all work cleanly.
- **Uses `sudo` only for the Node.js + pm2 install steps**, and only if not already root. Everything else runs as the invoking user.
- **`set -euo pipefail`** so any failure stops the script with a visible error rather than silently continuing.
- **No assumptions about CWD** — uses `SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"` and operates relative to that.

### Files touched

- **New**: `telegram-bot/bootstrap.sh` (executable, ~60 lines of bash).
- **Edit**: `telegram-bot/README.md` — add a short "Quick bootstrap" section at the top showing:

  ```bash
  cd telegram-bot
  chmod +x bootstrap.sh
  ./bootstrap.sh
  ```

  with a note that the script will pause and tell you what to do if `.env` or `docs/` aren't ready yet.

No changes to the bot's runtime code, dependencies, or behavior.
