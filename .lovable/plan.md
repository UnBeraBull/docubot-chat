
# Telegram Docs Bot — Plan

A self-contained Node.js project (separate from the Lovable web app) that you can `git clone` onto your VPS, `npm install`, set 2 env vars, and run with `pm2`. It uses Telegram long-polling (no public URL needed), Groq for chat completions, and a local vector index built from your `.md` files for retrieval.

## What gets built

A new folder `telegram-bot/` at the project root, structured as a standalone Node app:

```text
telegram-bot/
  package.json
  .env.example          # TELEGRAM_BOT_TOKEN, GROQ_API_KEY, DOCS_DIR
  README.md             # VPS deploy steps (pm2 / systemd)
  src/
    index.js            # bot entry — long-polling loop
    groq.js             # Groq chat client (OpenAI-compatible)
    rag/
      chunk.js          # split .md into ~500-token chunks (preserves headings)
      embed.js          # embeddings via Groq-compatible provider (see note)
      index.js          # build + load local vector store (JSON file on disk)
      search.js         # cosine top-k retrieval
    memory.js           # per-chat sliding window (last N turns, in-memory Map)
    docs/
      build-index.js    # CLI: `node src/docs/build-index.js` → writes vectors.json
  docs/                 # YOUR .md files live here (gitignored or your own repo)
  data/
    vectors.json        # generated embedding index (gitignored)
```

## How it works

1. **Index build (one-off / on docs change)**
   `npm run index` walks `DOCS_DIR`, chunks each `.md` by headings + size, embeds each chunk, writes `data/vectors.json` (array of `{file, heading, text, embedding}`).
2. **Bot runtime** (`npm start`)
   - Loads `vectors.json` into memory at startup.
   - Starts Telegram long-polling.
   - On each message: embed the user query → cosine top-K (default 5) chunks → build a prompt `[system + retrieved context + last N turns + new user message]` → Groq chat completion → reply in Telegram.
   - Per-chat memory: `Map<chatId, Message[]>`, capped at last N turns (default 8). Cleared on restart (you chose in-memory).
3. **Updating docs**: edit/add `.md` files → re-run `npm run index` → `pm2 restart bot`.

## Embeddings note (important)

Groq does **not** currently host an embeddings endpoint — only chat/completions. RAG needs vectors. Options:

- **A. Local embeddings** (recommended for VPS, no extra key): use `@xenova/transformers` with `all-MiniLM-L6-v2`. Runs on CPU, ~80MB model, downloads on first run.
- **B. Hosted embeddings**: add an OpenAI / Voyage / Jina API key just for embeddings.

I'll default to **A** so you only need the two keys you already have.

## Deployment to your VPS

```bash
git clone <repo> && cd telegram-bot
cp .env.example .env   # fill in TELEGRAM_BOT_TOKEN + GROQ_API_KEY
npm install
# put your .md files in ./docs (or set DOCS_DIR to wherever they live)
npm run index
pm2 start src/index.js --name docs-bot
pm2 save
```

README will include a systemd unit alternative.

## Can it run from Lovable instead?

Technically yes via a `/api/public/telegram/webhook` route, but with caveats: Lovable's Worker SSR runtime can't run `@xenova/transformers` (native deps), so you'd need hosted embeddings + a vector store (Lovable Cloud + pgvector). Different architecture, more moving parts. **Recommendation:** ship the VPS version first; if you later want to migrate to Lovable, we build a parallel webhook variant then.

## Open decisions (sensible defaults if you don't care)

- Groq model: `llama-3.3-70b-versatile` (default). Override via env.
- Chunk size: ~500 tokens, 50-token overlap.
- Top-K retrieved: 5.
- Memory window: last 8 turns per chat.
- Bot mode: replies to any DM and to `@yourbot ...` mentions in groups.

If those defaults are fine and embeddings option **A** works for you, I'll generate all the files on the next turn.
