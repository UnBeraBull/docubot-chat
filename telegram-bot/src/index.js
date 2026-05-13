import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { loadIndex } from "./rag/index.js";
import { embed } from "./rag/embed.js";
import { topK } from "./rag/search.js";
import { groqChat } from "./groq.js";
import { appendTurn, getHistory, clearHistory } from "./memory.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const TOP_K = parseInt(process.env.TOP_K || "5", 10);
const MEMORY_TURNS = parseInt(process.env.MEMORY_TURNS || "8", 10);

if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions strictly using the provided documentation context.

Rules:
- Prefer information from the CONTEXT section. If the answer isn't there, say so plainly instead of guessing.
- Be concise and direct. Use short paragraphs or bullet lists.
- When useful, cite the source file in parentheses, e.g. (see: setup.md).
- If the user asks something off-topic, gently steer them back to the documentation.`;

function buildContextBlock(hits) {
  return hits
    .map((h, i) => {
      const head = h.entry.heading ? ` — ${h.entry.heading}` : "";
      return `[${i + 1}] ${h.entry.file}${head}\n${h.entry.text}`;
    })
    .join("\n\n---\n\n");
}

async function answer(chatId, userText, index, botUsername) {
  // Strip @botname mention if present (group chats).
  let q = userText;
  if (botUsername) {
    q = q.replace(new RegExp(`@${botUsername}\\b`, "gi"), "").trim();
  }
  if (!q) return "Ask me anything about the docs.";

  const queryEmb = await embed(q);
  const hits = topK(queryEmb, index, TOP_K);
  const context = buildContextBlock(hits);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `CONTEXT:\n\n${context}` },
    ...getHistory(chatId),
    { role: "user", content: q },
  ];

  const reply = await groqChat({
    messages,
    model: GROQ_MODEL,
    apiKey: GROQ_API_KEY,
  });
  appendTurn(chatId, q, reply, MEMORY_TURNS);
  return reply;
}

async function main() {
  console.log("Loading vector index...");
  const index = await loadIndex();
  console.log(`Loaded ${index.length} chunks.`);

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  const me = await bot.getMe();
  const botUsername = me.username;
  console.log(`Bot online as @${botUsername}. Listening for messages...`);

  bot.on("polling_error", (err) => console.error("polling_error:", err.message));

  bot.onText(/^\/start\b/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "Hi! Ask me anything about the documentation. /reset clears our conversation.",
    );
  });

  bot.onText(/^\/reset\b/, (msg) => {
    clearHistory(msg.chat.id);
    bot.sendMessage(msg.chat.id, "Conversation memory cleared.");
  });

  bot.on("message", async (msg) => {
    const text = msg.text;
    if (!text) return;
    if (text.startsWith("/")) return; // commands handled above

    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
    if (isGroup) {
      // Only respond when the bot is mentioned or replied to.
      const mentioned = text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
      const repliedToBot =
        msg.reply_to_message && msg.reply_to_message.from?.username === botUsername;
      if (!mentioned && !repliedToBot) return;
    }

    try {
      await bot.sendChatAction(msg.chat.id, "typing");
      const reply = await answer(msg.chat.id, text, index, botUsername);
      await bot.sendMessage(msg.chat.id, reply, {
        reply_to_message_id: isGroup ? msg.message_id : undefined,
      });
    } catch (err) {
      console.error("answer error:", err);
      await bot.sendMessage(
        msg.chat.id,
        "Sorry, something went wrong answering that. Try again in a moment.",
      );
    }
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    try {
      await bot.stopPolling();
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
