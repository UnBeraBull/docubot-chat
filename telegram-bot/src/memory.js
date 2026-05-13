// Per-chat sliding-window memory. In-memory only; cleared on restart.
const store = new Map();

export function getHistory(chatId) {
  return store.get(chatId) ?? [];
}

export function appendTurn(chatId, userMsg, assistantMsg, maxTurns = 8) {
  const history = store.get(chatId) ?? [];
  history.push({ role: "user", content: userMsg });
  history.push({ role: "assistant", content: assistantMsg });
  // Keep only the last `maxTurns` * 2 messages.
  const max = maxTurns * 2;
  while (history.length > max) history.shift();
  store.set(chatId, history);
}

export function clearHistory(chatId) {
  store.delete(chatId);
}
