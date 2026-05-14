# Telegram Docs Bot

A standalone Node.js Telegram bot that answers questions over a folder of
Markdown documentation using **Groq** for chat completions and a local
**vector index** (RAG) for retrieval. No public URL needed — uses Telegram
long-polling.

## Quick bootstrap (fresh Ubuntu/Debian VPS)

```bash
cd telegram-bot
chmod +x bootstrap.sh
./bootstrap.sh
```

The script installs Node.js 20 + pm2, installs dependencies, builds the
vector index, and starts the bot under pm2. If `.env` or your `docs/`
folder isn't ready yet, it stops with a clear message and you re-run
the same command after fixing it. Re-running is always safe.

The manual steps below are for non-Debian systems or if you prefer to
do it by hand.

## Requirements

- Node.js 18.17+
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- A Groq API key (from <https://console.groq.com/keys>)

## Setup

```bash
cd telegram-bot
cp .env.example .env
# fill in TELEGRAM_BOT_TOKEN and GROQ_API_KEY
npm install
```

Put your `.md` files anywhere and point `DOCS_DIR` at that folder
(default `./docs`).

## Build the index

Run this once, and again whenever you change your docs:

```bash
npm run index
```

First run downloads the embedding model (~80 MB) and caches it locally.
Re-runs are fast.

## Run the bot

```bash
npm start
```

The bot:

- Replies to **DMs** with answers grounded in your docs.
- In **groups**, only responds when @-mentioned or when a user replies to
  one of its messages.
- `/start` — welcome message.
- `/reset` — clear that chat's short conversation memory.

## Deploy on a VPS with pm2

```bash
npm install -g pm2
pm2 start src/index.js --name docs-bot --cwd /path/to/telegram-bot
pm2 save
pm2 startup        # follow the printed command to enable boot-start
```

Restart after updating docs:

```bash
npm run index && pm2 restart docs-bot
```

## Deploy with systemd (alternative)

`/etc/systemd/system/docs-bot.service`:

```ini
[Unit]
Description=Telegram Docs Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/telegram-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
User=www-data
EnvironmentFile=/opt/telegram-bot/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now docs-bot
sudo journalctl -u docs-bot -f
```

## Config (env vars)

| Var                  | Default                       | Notes                                |
| -------------------- | ----------------------------- | ------------------------------------ |
| `TELEGRAM_BOT_TOKEN` | —                             | required                             |
| `GROQ_API_KEY`       | —                             | required                             |
| `DOCS_DIR`           | `./docs`                      | folder of `.md`/`.mdx` files         |
| `GROQ_MODEL`         | `llama-3.3-70b-versatile`     | any Groq chat model id               |
| `TOP_K`              | `5`                           | chunks retrieved per query           |
| `MEMORY_TURNS`       | `8`                           | per-chat user/assistant turn pairs   |
| `CHUNK_SIZE`         | `500`                         | approx tokens per chunk (indexing)   |
| `CHUNK_OVERLAP`      | `50`                          | approx tokens of overlap (indexing)  |

## How it works

1. `npm run index` walks `DOCS_DIR`, splits each `.md` by headings + size
   into ~500-token chunks, embeds each chunk locally with
   `Xenova/all-MiniLM-L6-v2`, and writes `data/vectors.json`.
2. `npm start` loads that index into memory, opens a Telegram long-poll
   loop, and on each user message: embeds the query, picks the top-K
   chunks by cosine similarity, builds a prompt with system + retrieved
   context + recent turns + the user message, and calls Groq for the
   reply.
3. Per-chat memory is in-memory only and clears on restart or `/reset`.

## Notes

- Groq does not currently host an embeddings endpoint, so embeddings run
  locally on CPU via `@xenova/transformers`. This keeps your API
  surface to just the two keys you already have.
- The bot is intentionally separate from any web app — it can live in
  its own repo and be deployed independently.
