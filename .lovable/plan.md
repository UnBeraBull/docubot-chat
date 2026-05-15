## Troubleshooting plan

The reset ruled out Telegram conversation memory, so the next step is to confirm the VPS is actually running the updated bot process and updated generated index.

### 1. Confirm the running process path
On the VPS, run:

```bash
pm2 describe docs-bot
```

Check these fields:
- `script path`
- `cwd`
- `args`

They should point to:

```bash
/root/docubot-chat/telegram-bot
node src/index.js
```

If `cwd` points somewhere else, PM2 is running an old clone or old directory.

### 2. Confirm the live file contains the new prompt
On the VPS, run:

```bash
cd ~/docubot-chat/telegram-bot
grep -n "Never mention filenames\|CONTEXT section\|see:" src/index.js
```

Expected:
- You should see the new `Never mention filenames...` rule.
- You should not see old wording that tells it to mention `CONTEXT section`, `see:`, or filenames.

If the old wording appears, the VPS file is not actually updated despite the GitHub pull.

### 3. Restart PM2 from the correct directory
Even if `git pull` worked, restart from the bot folder:

```bash
cd ~/docubot-chat/telegram-bot
pm2 restart docs-bot --update-env
pm2 logs docs-bot --lines 30
```

Look for:

```text
Loading vector index...
Loaded X chunks.
Bot online as @...
```

### 4. Check whether the vector index itself contains filenames
The model may be seeing filenames inside the indexed chunk text, not only in metadata. Run:

```bash
cd ~/docubot-chat/telegram-bot
grep -RIn --include='*.json' --include='*.jsonl' --include='*.txt' "[0-9]-.*\.md\|\.md" . | head -50
```

If this shows `.md` filenames in generated index/cache files, rebuild the index after the latest sanitization changes:

```bash
npm run index
pm2 restart docs-bot --update-env
```

Then reset Telegram again:

```text
/reset
```

### 5. Add a stronger final safeguard if it still happens
If the running code and index are both updated but filenames still appear, the next code change should add an outbound sanitizer before `sendMessage` that removes filename-looking citations while preserving public URLs.

The sanitizer should:
- Remove references like `see: 4-what-we-are-building.md`
- Remove standalone `.md` filenames and paths
- Preserve `https://...` and `http://...` URLs, even when those URLs appear in the reference docs
- Optionally regenerate or replace the reply if sanitization removes too much text

### Most likely cause
Since `/reset` did not fix it, the most likely causes are:
1. PM2 is running a different directory/process than the one you pulled, or
2. the local RAG index was built before the filename-hiding change and still contains filename text.

Start with `pm2 describe docs-bot` and the two `grep` checks above.