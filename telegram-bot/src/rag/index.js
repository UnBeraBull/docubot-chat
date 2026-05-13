import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_INDEX_PATH = path.resolve("data", "vectors.json");

export async function loadIndex(indexPath = DEFAULT_INDEX_PATH) {
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Index is not an array");
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `No vector index found at ${indexPath}. Run \`npm run index\` first.`,
      );
    }
    throw err;
  }
}

export async function saveIndex(entries, indexPath = DEFAULT_INDEX_PATH) {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(entries));
}

export { DEFAULT_INDEX_PATH };
