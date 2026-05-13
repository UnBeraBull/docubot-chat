// Local embeddings via @xenova/transformers (all-MiniLM-L6-v2, 384-d).
// Runs entirely on CPU. The model (~80MB) downloads on first use and
// is cached under ~/.cache/huggingface or the local node_modules cache.
import { pipeline, env } from "@xenova/transformers";

// Don't try to load local models from disk — always use the bundled one.
env.allowLocalModels = false;

let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }
  return extractorPromise;
}

export async function embed(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array; convert to plain array for JSON storage.
  return Array.from(output.data);
}

export async function embedMany(texts, { onProgress } = {}) {
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await embed(texts[i]));
    if (onProgress) onProgress(i + 1, texts.length);
  }
  return out;
}
