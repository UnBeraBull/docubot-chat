## Goal

Stop the bot from ever citing source `.md` filenames, while still allowing it to include URLs that appear inside the docs themselves.

## Changes (all in `telegram-bot/src/index.js`)

### 1. Update the system prompt
- Remove the line that tells the model to cite source files (`e.g. (see: setup.md)`).
- Add explicit rules:
  - Never mention filenames, file paths, or that the answer comes from "documents/files/docs."
  - If the context contains URLs (http/https), you may include them verbatim when genuinely useful to the user.
- Tone stays the same; just swap the citation rule for a "no filenames, URLs OK" rule.

### 2. Stop sending filenames into the context block
Currently each chunk is labeled with its filename:

```js
`[${i + 1}] ${h.entry.file}${head}\n${h.entry.text}`
```

Change to label chunks by number only (and keep the heading, since headings are content-level and don't leak file structure):

```js
`[${i + 1}]${head}\n${h.entry.text}`
```

This way the model literally cannot output a filename it never saw. URLs embedded inside `h.entry.text` are untouched and remain available for the model to quote.

### 3. No changes needed to the indexer, chunker, embeddings, or RAG search
Filenames stay in `vectors.json` (we still need them internally for debugging and to support future features), they just aren't shown to the model anymore.

## Deployment steps for you (after I make the code change)

On your VPS:

```bash
cd ~/docubot-chat
git pull
pm2 restart docs-bot
pm2 logs docs-bot
```

No need to re-run `npm run index` — the vector index doesn't change, only the prompt/context formatting does.

## Verification

- Ask the bot a question whose answer lives in a doc that contains a URL → it should answer and include the URL, with no filename mentioned.
- Ask a question whose answer is in a doc with no URL → it should answer cleanly, with no "(see: foo.md)" tail.
- Ask something not in the docs → it should say it doesn't know, again without naming files.
