/**
 * QMD (query-augmented markdown) integration: collections, context, embedding.
 */
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { EXIT, fail } from "./errors.js";
import { run, runSoft } from "./run.js";
import type { GlState, Pin } from "./types.js";

export function collectionName(pin: Pin): string {
  return `${pin.name}@${pin.sha}`;
}

export function indexName(pin: Pin): string {
  return `${pin.name}_${pin.sha}`;
}

export function pinQmd(pin: Pin, args: string[]): string[] {
  return ["--index", indexName(pin), ...args];
}

export function collectionExists(pin: Pin, collection: string): boolean {
  const out = run("qmd", pinQmd(pin, ["collection", "list"]));
  return out.includes(collection);
}

export function contextExists(pin: Pin, collection: string): boolean {
  const out = run("qmd", pinQmd(pin, ["context", "list"]));
  return out.includes(collection);
}

/** Returns count of document hashes needing embedding, or null if DB missing/unreadable. */
export function needsEmbeddingCount(state: GlState, pin: Pin): number | null {
  const dbPath = path.join(state.rootDir, "qmd", "cache", "qmd", `${indexName(pin)}.sqlite`);
  if (!existsSync(dbPath)) return null;
  const result = runSoft("sqlite3", [
    dbPath,
    "SELECT COUNT(DISTINCT d.hash) FROM documents d LEFT JOIN content_vectors v ON d.hash=v.hash AND v.seq=0 WHERE d.active=1 AND v.hash IS NULL",
  ]);
  if (!result.ok) return null;
  const n = parseInt(result.stdout?.trim() ?? "", 10);
  return Number.isNaN(n) ? null : n;
}

export function assertCollectionHealthy(pin: Pin, collection: string): void {
  const status = run("qmd", pinQmd(pin, ["status"]));
  const vectorsLine = status
    .split(/\r?\n/)
    .find((line) => line.toLowerCase().includes(collection.toLowerCase()) && line.toLowerCase().includes("vector"));
  if (vectorsLine) {
    const numberMatch = vectorsLine.match(/vectors[^0-9]*(\d+)/i);
    if (numberMatch && Number(numberMatch[1]) <= 0) {
      fail(`collection ${collection} has zero vectors`, EXIT.STATE);
    }
  }
}

export function cleanupQmdFiles(state: GlState, pin: Pin): void {
  const prefix = `${indexName(pin)}.`;
  const dirs = [
    path.join(state.rootDir, "qmd", "config", "qmd"),
    path.join(state.rootDir, "qmd", "cache", "qmd"),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.startsWith(prefix)) {
        try {
          unlinkSync(path.join(dir, f));
        } catch {
          /* ignore */
        }
      }
    }
  }
}
