// Cosine similarity search over an in-memory array of vectors.
// Embeddings from MiniLM are L2-normalized, so cosine == dot product, but we
// compute the safe form anyway in case the index was built differently.

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

export function cosine(a, b) {
  const denom = norm(a) * norm(b);
  if (denom === 0) return 0;
  return dot(a, b) / denom;
}

export function topK(queryEmbedding, entries, k = 5) {
  const scored = entries.map((e) => ({
    score: cosine(queryEmbedding, e.embedding),
    entry: e,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
