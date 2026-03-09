/**
 * Pure reconcile utilities: safeName, makeQueueFilename, parseSearchJson,
 * normalizeKnowledgeRelPath, chooseMatchedKnowledgePath.
 */
import { createHash } from "node:crypto";

export function safeName(input: string | null | undefined): string {
  const cleaned = String(input || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "entry";
}

export function makeQueueFilename(content: string, nameArg: string | null | undefined): string {
  if (nameArg) {
    const base = safeName(nameArg);
    return base.toLowerCase().endsWith(".md") ? base : `${base}.md`;
  }
  return `${createHash("sha256").update(content).digest("hex").slice(0, 12)}.md`;
}

export function parseSearchJson(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeKnowledgeRelPath(pathFromSearch: string | null | undefined): string | null {
  const p = String(pathFromSearch || "").replace(/^\/+/, "");
  if (!p) return null;
  return p.startsWith("knowledge/") ? p.slice("knowledge/".length) : p;
}

export function chooseMatchedKnowledgePath(results: unknown[]): string | null {
  for (const r of results) {
    const obj = r as Record<string, unknown> | null | undefined;
    if (!obj) continue;
    const candidate =
      (obj.path as string) ??
      (obj.filepath as string) ??
      (obj.file as string) ??
      (obj.docPath as string) ??
      (obj.docpath as string);
    if (candidate) return normalizeKnowledgeRelPath(candidate);
  }
  return null;
}
