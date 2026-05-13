// Thin Groq chat-completions client. Groq exposes an OpenAI-compatible API.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function groqChat({ messages, model, apiKey, temperature = 0.2 }) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
