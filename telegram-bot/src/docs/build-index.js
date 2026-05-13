// CLI: walk DOCS_DIR, chunk every .md file, embed each chunk, write data/vectors.json.
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { chunkMarkdown } from "../rag/chunk.js";
import { embedMany } from "../rag/embed.js";
import { saveIndex, DEFAULT_INDEX_PATH } from "../rag/index.js";

const DOCS_DIR = path.resolve(process.env.DOCS_DIR || "./docs");
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "500", 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || "50", 10);

async function walkMarkdown(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`DOCS_DIR not found: ${dir}`);
    }
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(full)));
    } else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  console.log(`Scanning ${DOCS_DIR} for .md files...`);
  const files = await walkMarkdown(DOCS_DIR);
  if (files.length === 0) {
    console.error("No .md files found. Add docs and re-run.");
    process.exit(1);
  }
  console.log(`Found ${files.length} file(s). Chunking...`);

  const allChunks = [];
  for (const file of files) {
    const md = await fs.readFile(file, "utf8");
    const rel = path.relative(DOCS_DIR, file);
    const chunks = chunkMarkdown(md, rel, {
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    allChunks.push(...chunks);
  }
  console.log(`Produced ${allChunks.length} chunk(s). Embedding (this can take a minute on first run while the model downloads)...`);

  const texts = allChunks.map(
    (c) => (c.heading ? `${c.heading}\n\n${c.text}` : c.text),
  );
  const embeddings = await embedMany(texts, {
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) {
        console.log(`  embedded ${done}/${total}`);
      }
    },
  });

  const entries = allChunks.map((c, i) => ({ ...c, embedding: embeddings[i] }));
  await saveIndex(entries);
  console.log(`Wrote ${entries.length} entries to ${DEFAULT_INDEX_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
