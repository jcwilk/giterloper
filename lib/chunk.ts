/**
 * QMD-compatible document chunking. Pure TypeScript reimplementation of
 * @tobilu/qmd store.js chunkDocument logic for use without native Node deps.
 * Used by reconcile to split content for semantic search matching.
 */
const CHUNK_SIZE_CHARS = 900 * 4; // ~3600 chars (~4 chars per token)
const CHUNK_OVERLAP_CHARS = Math.floor(CHUNK_SIZE_CHARS * 0.15); // 540
const CHUNK_WINDOW_CHARS = 200 * 4; // 800

const BREAK_PATTERNS: [RegExp, number, string][] = [
  [/\n#{1}(?!#)/g, 100, "h1"],
  [/\n#{2}(?!#)/g, 90, "h2"],
  [/\n#{3}(?!#)/g, 80, "h3"],
  [/\n#{4}(?!#)/g, 70, "h4"],
  [/\n#{5}(?!#)/g, 60, "h5"],
  [/\n#{6}(?!#)/g, 50, "h6"],
  [/\n```/g, 80, "codeblock"],
  [/\n(?:---|\*\*\*|___)\s*\n/g, 60, "hr"],
  [/\n\n+/g, 20, "blank"],
  [/\n[-*]\s/g, 5, "list"],
  [/\n\d+\.\s/g, 5, "numlist"],
  [/\n/g, 1, "newline"],
];

interface BreakPoint {
  pos: number;
  score: number;
  type: string;
}

interface CodeFence {
  start: number;
  end: number;
}

function scanBreakPoints(text: string): BreakPoint[] {
  const points: BreakPoint[] = [];
  const seen = new Map<number, BreakPoint>();
  for (const [pattern, score, type] of BREAK_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const pos = match.index ?? 0;
      const existing = seen.get(pos);
      if (!existing || score > existing.score) {
        const bp: BreakPoint = { pos, score, type };
        seen.set(pos, bp);
      }
    }
  }
  for (const bp of seen.values()) points.push(bp);
  return points.sort((a, b) => a.pos - b.pos);
}

function findCodeFences(text: string): CodeFence[] {
  const regions: CodeFence[] = [];
  const fencePattern = /\n```/g;
  let inFence = false;
  let fenceStart = 0;
  for (const match of text.matchAll(fencePattern)) {
    if (!inFence) {
      fenceStart = match.index ?? 0;
      inFence = true;
    } else {
      regions.push({
        start: fenceStart,
        end: (match.index ?? 0) + (match[0]?.length ?? 0),
      });
      inFence = false;
    }
  }
  if (inFence) regions.push({ start: fenceStart, end: text.length });
  return regions;
}

function isInsideCodeFence(pos: number, fences: CodeFence[]): boolean {
  return fences.some((f) => pos > f.start && pos < f.end);
}

function findBestCutoff(
  breakPoints: BreakPoint[],
  targetCharPos: number,
  windowChars: number = CHUNK_WINDOW_CHARS,
  decayFactor: number = 0.7,
  codeFences: CodeFence[] = []
): number {
  const windowStart = targetCharPos - windowChars;
  let bestScore = -1;
  let bestPos = targetCharPos;
  for (const bp of breakPoints) {
    if (bp.pos < windowStart) continue;
    if (bp.pos > targetCharPos) break;
    if (isInsideCodeFence(bp.pos, codeFences)) continue;
    const distance = targetCharPos - bp.pos;
    const normalizedDist = distance / windowChars;
    const multiplier = 1.0 - normalizedDist * normalizedDist * decayFactor;
    const finalScore = bp.score * multiplier;
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestPos = bp.pos;
    }
  }
  return bestPos;
}

export interface Chunk {
  text: string;
  pos: number;
}

export function chunkDocument(
  content: string,
  maxChars: number = CHUNK_SIZE_CHARS,
  overlapChars: number = CHUNK_OVERLAP_CHARS,
  windowChars: number = CHUNK_WINDOW_CHARS
): Chunk[] {
  if (content.length <= maxChars) return [{ text: content, pos: 0 }];
  const breakPoints = scanBreakPoints(content);
  const codeFences = findCodeFences(content);
  const chunks: Chunk[] = [];
  let charPos = 0;
  while (charPos < content.length) {
    const targetEndPos = Math.min(charPos + maxChars, content.length);
    let endPos = targetEndPos;
    if (endPos < content.length) {
      const bestCutoff = findBestCutoff(
        breakPoints,
        targetEndPos,
        windowChars,
        0.7,
        codeFences
      );
      if (bestCutoff > charPos && bestCutoff <= targetEndPos) endPos = bestCutoff;
    }
    if (endPos <= charPos) {
      endPos = Math.min(charPos + maxChars, content.length);
    }
    chunks.push({ text: content.slice(charPos, endPos), pos: charPos });
    if (endPos >= content.length) break;
    charPos = endPos - overlapChars;
    const lastChunkPos = chunks.at(-1)!.pos;
    if (charPos <= lastChunkPos) charPos = endPos;
  }
  return chunks;
}
