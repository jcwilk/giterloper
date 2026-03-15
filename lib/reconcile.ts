/**
 * Topic-first reconciliation: integrate knowledge/_pending into knowledge/ by topic.
 * Processes pending files in commit order, groups by subject, merges into topic files,
 * adds Sources, deletes pending only after successful representation.
 * Rudimentary but deterministic and auditable.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getRemoteOriginUrl } from "./git.ts";
import { getFileAddEpochViaApi, parseGithubSource } from "./github.ts";
import { run, runSoft } from "./run.ts";

const PENDING_DIR = "knowledge/_pending";
const KNOWLEDGE_DIR = "knowledge";

export interface PendingEntry {
  /** Relative path e.g. knowledge/_pending/foo.md */
  path: string;
  /** Commit timestamp (epoch seconds) when file was added, for ordering */
  addEpoch: number;
  /** File content */
  content: string;
}

export interface ReconcileResult {
  ok: true;
  oldSha: string;
  newSha: string;
  touched: string[];
  unresolved: string[];
  deleted: string[];
}

export interface ReconcileError {
  ok: false;
  message: string;
  unresolved?: string[];
}

const FIRST_HEADING = /^#\s+(.+)$/m;

/** Extract topic from content: first # heading, or "general". Sanitized for filename. */
export function extractTopic(content: string, fallbackFilename: string): string {
  const m = content.match(FIRST_HEADING);
  const raw = m ? m[1].trim() : path.basename(fallbackFilename, ".md");
  const sanitized = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "") || "general";
  return sanitized;
}

/** Rudimentary strip: collapse 3+ newlines to 2. Preserves citations/links. */
export function stripBoilerplate(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Get add timestamp for a file: from GitHub API when available, else from git log. */
async function addEpochForFile(
  repoDir: string,
  rel: string,
  source: string | null,
  useApi: boolean
): Promise<number> {
  if (useApi && source) {
    const headSha = runSoft("git", ["-C", repoDir, "rev-parse", "HEAD"]);
    if (headSha.ok && headSha.stdout?.trim()) {
      const epoch = await getFileAddEpochViaApi(source, rel, headSha.stdout.trim());
      if (epoch > 0) return epoch;
    }
  }
  const out = runSoft("git", ["-C", repoDir, "log", "-1", "--format=%ct", "--diff-filter=A", "--", rel]);
  const addEpoch = out.ok && out.stdout ? parseInt(out.stdout.trim(), 10) : 0;
  return isNaN(addEpoch) ? 0 : addEpoch;
}

/**
 * Comparator for PendingEntry by addEpoch: earliest first; addEpoch 0 (unknown) sorts last.
 */
export function comparePendingByAddEpoch(a: PendingEntry, b: PendingEntry): number {
  return a.addEpoch === 0
    ? b.addEpoch === 0
      ? 0
      : 1
    : b.addEpoch === 0
      ? -1
      : a.addEpoch - b.addEpoch;
}

/**
 * Get pending files in commit order (earliest add first). Uses GitHub API for add timestamp when repo is GitHub and token available (works with shallow clones).
 * Entries with addEpoch 0 (API and git log both yield 0, e.g. shallow clone without API) are included and ordered last.
 */
export async function getPendingInCommitOrder(repoDir: string): Promise<PendingEntry[]> {
  const pendingPath = path.join(repoDir, PENDING_DIR);
  if (!existsSync(pendingPath)) return [];
  const files = readdirSync(pendingPath).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return [];

  const remoteUrl = getRemoteOriginUrl(repoDir);
  const useApi = !!(remoteUrl && parseGithubSource(remoteUrl));

  const entries: PendingEntry[] = [];
  for (const f of files) {
    const rel = `${PENDING_DIR}/${f}`;
    const fullPath = path.join(repoDir, rel);
    if (!existsSync(fullPath)) continue;
    const addEpoch = await addEpochForFile(repoDir, rel, remoteUrl, useApi);
    const content = readFileSync(fullPath, "utf8");
    entries.push({ path: rel, addEpoch, content });
  }
  entries.sort(comparePendingByAddEpoch);
  return entries;
}

/** Group entries by topic. */
export function groupByTopic(entries: PendingEntry[]): Map<string, PendingEntry[]> {
  const map = new Map<string, PendingEntry[]>();
  for (const e of entries) {
    const topic = extractTopic(e.content, path.basename(e.path));
    const list = map.get(topic) ?? [];
    list.push(e);
    map.set(topic, list);
  }
  return map;
}

/** Build merged content for a topic: existing + new entries with Sources. */
export function mergeTopicContent(
  existingContent: string | null,
  entries: PendingEntry[]
): string {
  const parts: string[] = [];
  if (existingContent && existingContent.trim()) {
    parts.push(stripBoilerplate(existingContent));
  }
  const sources: string[] = [];
  for (const e of entries) {
    const body = stripBoilerplate(e.content);
    const filename = path.basename(e.path);
    sources.push(`- \`${filename}\``);
    parts.push(body);
  }
  const merged = parts.join("\n\n---\n\n");
  const sourcesBlock = sources.length > 0 ? `\n\n## Sources\n\n${sources.join("\n")}` : "";
  return merged + sourcesBlock;
}

/**
 * Reconcile: process pending into topic files, delete pending only after success.
 * Returns oldSha/newSha, touched paths, unresolved (if any), deleted pending paths.
 * No silent data loss: unresolved files stay in _pending.
 */
export async function reconcile(repoDir: string): Promise<ReconcileResult | ReconcileError> {
  const oldSha = run("git", ["-C", repoDir, "rev-parse", "HEAD"]).trim();
  const entries = await getPendingInCommitOrder(repoDir);
  if (entries.length === 0) {
    return { ok: true, oldSha, newSha: oldSha, touched: [], unresolved: [], deleted: [] };
  }

  const byTopic = groupByTopic(entries);
  const knowledgePath = path.join(repoDir, KNOWLEDGE_DIR);
  if (!existsSync(knowledgePath)) {
    const parent = path.dirname(knowledgePath);
    if (!existsSync(parent)) {
      return { ok: false, message: "knowledge/ parent directory does not exist", unresolved: entries.map((e) => e.path) };
    }
    mkdirSync(knowledgePath, { recursive: true });
  }

  const touched: string[] = [];
  const toDelete: string[] = [];

  for (const [topic, topicEntries] of byTopic) {
    const topicFile = `${topic}.md`;
    const topicPath = path.join(KNOWLEDGE_DIR, topicFile);
    const fullPath = path.join(repoDir, topicPath);
    const existing = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : null;
    const merged = mergeTopicContent(existing, topicEntries);
    writeFileSync(fullPath, merged.endsWith("\n") ? merged : `${merged}\n`, "utf8");
    touched.push(topicPath);
    for (const e of topicEntries) {
      toDelete.push(path.join(repoDir, e.path));
    }
  }

  for (const p of toDelete) {
    if (existsSync(p)) rmSync(p);
  }
  const deleted = entries.map((e) => e.path);

  run("git", ["-C", repoDir, "add", "-A", PENDING_DIR, KNOWLEDGE_DIR]);
  run("git", ["-C", repoDir, "commit", "-m", `gl: reconcile ${entries.length} pending into topic files`]);
  const newSha = run("git", ["-C", repoDir, "rev-parse", "HEAD"]).trim();

  return {
    ok: true,
    oldSha,
    newSha,
    touched,
    unresolved: [],
    deleted,
  };
}
