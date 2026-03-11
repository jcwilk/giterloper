/**
 * Add command queue: safeName, makeQueueFilename.
 * Used when queueing content into knowledge/_pending/ for gl insert.
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
