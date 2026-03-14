/**
 * Memsearch adapter with strict pin+sha isolation.
 *
 * Integrates memsearch as the search/index backend. Index manager is keyed by (pinName, sha).
 * Querying pin+sha A can never read index for pin+sha B. Stale/mismatched metadata causes
 * explicit failure (fail closed), never fallback to another version's index.
 *
 * Runtime: invokes memsearch CLI via subprocess. Requires memsearch installed (pip install memsearch).
 * See docs/MEMSEARCH_ADAPTER.md for boundary and assumptions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { fail } from "./errors.ts";
import { StaleIndexError } from "./errors.ts";
import type { GlState } from "./types.ts";
import type { Pin } from "./types.ts";
import { cloneDir, ensureDir, indexDir } from "./paths.ts";
import { run, runSoft } from "./run.ts";
import { verifyCloneAtSha } from "./pin-lifecycle.ts";

/** Metadata persisted with each index. Used to validate pin+sha before any query. */
export interface IndexMetadata {
  pinName: string;
  sha: string;
  sourcePath: string;
  buildFingerprint: string;
}

/** Single search result from memsearch. Maps to MCP giterloper_search result shape. */
export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

/** Options for buildIndex. */
export interface BuildIndexOptions {
  /** If true, re-embed all chunks even if unchanged. Default false. */
  force?: boolean;
}

const MEMSEARCH_CMD = "memsearch";
const METADATA_FILE = "metadata.json";
const MILVUS_FILE = "milvus.db";

/** Current build fingerprint. Change when chunk/embedding config changes to force rebuild. */
const BUILD_FINGERPRINT = "giterloper_v1";

/** Path to metadata.json for a given pin+sha. */
export function metadataPath(state: GlState, pinName: string, sha: string): string {
  return path.join(indexDir(state, pinName, sha), METADATA_FILE);
}

/** Path to milvus.db for a given pin+sha. */
function milvusDbPath(state: GlState, pinName: string, sha: string): string {
  return path.join(indexDir(state, pinName, sha), MILVUS_FILE);
}

/** Write metadata. Call after successful index build. Exported for tests. */
export function writeIndexMetadata(state: GlState, meta: IndexMetadata): void {
  const dir = indexDir(state, meta.pinName, meta.sha);
  ensureDir(dir);
  const p = metadataPath(state, meta.pinName, meta.sha);
  writeFileSync(p, JSON.stringify(meta, null, 2), "utf8");
}

/** Read metadata from an index directory. Returns null if missing or invalid. */
export function readIndexMetadata(state: GlState, pinName: string, sha: string): IndexMetadata | null {
  const p = metadataPath(state, pinName, sha);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as IndexMetadata;
    if (
      typeof parsed.pinName === "string" &&
      typeof parsed.sha === "string" &&
      typeof parsed.sourcePath === "string" &&
      typeof parsed.buildFingerprint === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Check that metadata matches requested pin+sha. Throws StaleIndexError on mismatch. */
function assertMetadataMatches(
  meta: IndexMetadata,
  pinName: string,
  sha: string
): void {
  if (meta.pinName !== pinName || meta.sha !== sha) {
    throw new StaleIndexError(
      `index metadata mismatch: index is for pin=${meta.pinName} sha=${meta.sha}, requested pin=${pinName} sha=${sha}`,
      meta.pinName,
      meta.sha,
      pinName,
      sha
    );
  }
}

/** Ensure clone exists at expected SHA. Returns clone directory path. */
function requireCloneAtSha(state: GlState, pin: Pin): string {
  const cdir = cloneDir(state, pin);
  if (!existsSync(cdir)) {
    fail(
      `clone missing for pin "${pin.name}" at ${pin.sha}. Run "gl pin load" or "gl pin update".`,
      2
    );
  }
  if (!verifyCloneAtSha(pin, cdir)) {
    fail(`clone at ${cdir} is not at expected SHA ${pin.sha}.`, 2);
  }
  return cdir;
}

/**
 * Build index for pin at its current SHA.
 * Indexes markdown files from the pin's clone directory.
 * Idempotent: re-running overwrites metadata and updates index incrementally (unless force).
 */
export function buildIndex(
  state: GlState,
  pin: Pin,
  opts: BuildIndexOptions = {}
): void {
  const sourcePath = requireCloneAtSha(state, pin);
  const dir = indexDir(state, pin.name, pin.sha);
  ensureDir(dir);
  const milvusUri = milvusDbPath(state, pin.name, pin.sha);

  const indexArgs = [sourcePath, "--milvus-uri", milvusUri];
  if (opts.force) indexArgs.push("--force");

  run(MEMSEARCH_CMD, ["index", ...indexArgs]);

  const meta: IndexMetadata = {
    pinName: pin.name,
    sha: pin.sha,
    sourcePath,
    buildFingerprint: BUILD_FINGERPRINT,
  };
  writeIndexMetadata(state, meta);
}

/**
 * Search indexed knowledge for pin at given SHA.
 * Fails closed: if index exists but metadata does not match pin+sha, throws StaleIndexError.
 * If index does not exist and buildOnDemand is true, builds then searches. Otherwise throws.
 */
export function search(
  state: GlState,
  pinName: string,
  sha: string,
  query: string,
  limit: number = 20,
  options: { buildOnDemand?: boolean; pin?: Pin } = {}
): SearchResult[] {
  const meta = readIndexMetadata(state, pinName, sha);
  const idxDir = indexDir(state, pinName, sha);
  const milvusUri = milvusDbPath(state, pinName, sha);

  if (meta) {
    assertMetadataMatches(meta, pinName, sha);
  } else if (options.buildOnDemand && options.pin) {
    if (options.pin.name !== pinName || options.pin.sha !== sha) {
      fail(
        `buildOnDemand requires pin matching requested pin=${pinName} sha=${sha}`,
        2
      );
    }
    buildIndex(state, options.pin);
  } else if (!existsSync(path.join(idxDir, MILVUS_FILE))) {
    fail(
      `no index for pin "${pinName}" at ${sha}. Build with memsearch adapter or enable buildOnDemand.`,
      2
    );
  } else {
    fail(
      `index for pin "${pinName}" at ${sha} has missing or invalid metadata. Rebuild required.`,
      2
    );
  }

  const result = runSoft(MEMSEARCH_CMD, [
    "search",
    query,
    "--milvus-uri",
    milvusUri,
    "--json-output",
    "--top-k",
    String(limit),
  ]);

  if (!result.ok) {
    fail(`memsearch search failed: ${result.stderr || result.stdout}`, 3);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout);
  } catch {
    fail(`memsearch returned invalid JSON: ${result.stdout}`, 3);
  }

  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((item: Record<string, unknown>) => ({
    path: String(item.source ?? ""),
    title: String(item.heading ?? ""),
    snippet: String(item.content ?? "").slice(0, 500),
    score: Number(item.score ?? 0),
  }));
}
