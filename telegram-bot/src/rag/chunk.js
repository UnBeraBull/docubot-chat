// Markdown chunker: splits a doc by top-level headings first, then by
// approximate token windows. Token count is approximated as words * 1.3.
const APPROX_TOKENS_PER_WORD = 1.3;

function wordsToApproxTokens(words) {
  return Math.ceil(words.length * APPROX_TOKENS_PER_WORD);
}

function splitBySize(text, heading, file, chunkTokens, overlapTokens) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const wordsPerChunk = Math.max(
    50,
    Math.floor(chunkTokens / APPROX_TOKENS_PER_WORD),
  );
  const overlapWords = Math.max(
    0,
    Math.floor(overlapTokens / APPROX_TOKENS_PER_WORD),
  );

  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + wordsPerChunk);
    const slice = words.slice(start, end).join(" ").trim();
    if (slice) chunks.push({ file, heading, text: slice });
    if (end === words.length) break;
    start = end - overlapWords;
    if (start <= 0) start = end; // safety
  }
  return chunks;
}

export function chunkMarkdown(
  markdown,
  file,
  { chunkSize = 500, chunkOverlap = 50 } = {},
) {
  // Split on headings (#, ##, ###) but keep the heading as section title.
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = { heading: "", body: [] };

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current.body.length || current.heading) sections.push(current);
      current = { heading: m[2].trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.length || current.heading) sections.push(current);

  const out = [];
  for (const sec of sections) {
    const body = sec.body.join("\n").trim();
    if (!body && !sec.heading) continue;

    // If the section is small enough, keep it whole.
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    if (wordsToApproxTokens({ length: wordCount }) <= chunkSize) {
      out.push({ file, heading: sec.heading, text: body });
    } else {
      out.push(...splitBySize(body, sec.heading, file, chunkSize, chunkOverlap));
    }
  }
  return out;
}
