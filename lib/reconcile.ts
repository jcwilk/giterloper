/**
 * Reconcile: integrate knowledge/_pending into the corpus under knowledge/ (recursive
 * .md files). Integration MUST be LLM-backed (OpenAI API) except empty pending or explicit
 * test override — see the reconciliation slice under specs/. Tests use `GITERLOPER_OPENAI_VCR` to replay fixtures.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getRemoteOriginUrl } from "./git.ts";
import { getFileAddEpochViaApi, parseGithubSource } from "./github.ts";
import { integrateCorpusWithOpenAi, type LlmCorpusResult } from "./reconcile-llm.ts";
import { run, runSoft } from "./run.ts";
import type { RetryLogContext } from "./types.ts";

const PENDING_DIR = "knowledge/_pending";
const KNOWLEDGE_DIR = "knowledge";

export interface PendingEntry {
  /** Relative path e.g. knowledge/_pending/foo.md */
  path: string;
  /** File content */
  content: string;
}

export interface ReconcileResult {
  ok: true;
  oldSha: string;
  newSha: string;
  touched: string[];
  deleted: string[];
}

export interface ReconcileError {
  ok: false;
  message: string;
  unresolved?: string[];
}

/** Optional hooks (tests); production uses env + OpenAI (or VCR when `GITERLOPER_OPENAI_VCR` is set). */
export interface ReconcileOptions {
  retryLog?: RetryLogContext;
  /**
   * When set, used instead of OpenAI integration (unit tests).
   * MUST perform LLM-equivalent integration or return ok: false — never deterministic-only success.
   */
  integrationOverride?: ReconcileIntegrationOverride;
}

export type ReconcileIntegrationOverride = (
  repoDir: string,
  entries: PendingEntry[],
  corpusBefore: Map<string, string>,
) => Promise<LlmCorpusResult>;

function normalizeReconcileSecond(second?: RetryLogContext | ReconcileOptions): ReconcileOptions {
  if (!second) return {};
  if (typeof second === "object" && ("integrationOverride" in second || "retryLog" in second)) {
    return second as ReconcileOptions;
  }
  return { retryLog: second as RetryLogContext };
}

const FIRST_HEADING = /^#\s+(.+)$/m;

/** Extract topic from content: first # heading, or "general". Sanitized for path segment. */
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

interface H2Section {
  title: string;
  body: string;
}

/** Normalize heading text for conflict keys. */
export function normalizeHeading(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugSegment(s: string): string {
  return normalizeHeading(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

/** Split into preamble (before first ##) and H2 sections. */
export function splitPreambleAndH2(content: string): { preamble: string; h2sections: H2Section[] } {
  const lines = content.split(/\n/);
  let firstH2 = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      firstH2 = i;
      break;
    }
  }
  if (firstH2 === -1) {
    return { preamble: content.trim(), h2sections: [] };
  }
  const preamble = lines.slice(0, firstH2).join("\n");
  const restLines = lines.slice(firstH2);
  const h2sections: H2Section[] = [];
  let i = 0;
  while (i < restLines.length) {
    const m = restLines[i].match(/^##\s+(.+)$/);
    if (!m) break;
    const title = m[1].trim();
    i++;
    const bodyLines: string[] = [];
    while (i < restLines.length && !/^##\s/.test(restLines[i])) {
      bodyLines.push(restLines[i]);
      i++;
    }
    h2sections.push({ title, body: bodyLines.join("\n") });
  }
  return { preamble: preamble.trim(), h2sections };
}

function rebuildFromPreambleAndH2(preamble: string, sections: H2Section[]): string {
  const parts: string[] = [];
  if (preamble.trim()) parts.push(preamble.trim());
  for (const s of sections) {
    parts.push(`## ${s.title}\n\n${s.body}`.trim());
  }
  return parts.join("\n\n").trim();
}

/** Remove H2 sections whose normalized title is in keys (incoming wins). */
export function stripH2SectionsMatching(content: string, keys: Set<string>): string {
  const { preamble, h2sections } = splitPreambleAndH2(content);
  const kept = h2sections.filter((s) => !keys.has(normalizeHeading(s.title)));
  const out = rebuildFromPreambleAndH2(preamble, kept);
  return stripBoilerplate(out);
}

/** Collect normalized H2 titles from markdown. */
export function collectH2Keys(markdown: string): string[] {
  const keys: string[] = [];
  for (const line of markdown.split(/\n/)) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) keys.push(normalizeHeading(m[1]));
  }
  return keys;
}

/** Split markdown into two substantive parts for multi-file placement. */
export function splitTwoWays(markdown: string): [string, string] {
  const t = markdown.trim();
  const paraBreak = t.indexOf("\n\n");
  if (paraBreak > 0 && paraBreak < t.length - 2) {
    return [t.slice(0, paraBreak).trim(), t.slice(paraBreak + 2).trim()];
  }
  const mid = Math.max(1, Math.floor(t.length / 2));
  return [t.slice(0, mid).trim(), t.slice(mid).trim()];
}

export interface PlannedChunk {
  relPath: string;
  markdown: string;
  pendingBasename: string;
}

/**
 * Decompose one pending entry into at least two corpus files under knowledge/<topic>/...
 * (agent-equivalent placement — not a single topic-file append for the whole item).
 */
export function decomposePendingEntry(entry: PendingEntry): PlannedChunk[] {
  const topic = extractTopic(entry.content, path.basename(entry.path));
  const stem = path.basename(entry.path, ".md");
  const baseDir = `${KNOWLEDGE_DIR}/${topic}`;
  const pendingBasename = path.basename(entry.path);
  const { preamble, h2sections } = splitPreambleAndH2(entry.content);

  if (h2sections.length >= 2) {
    return h2sections.map((sec, idx) => {
      const md =
        idx === 0
          ? rebuildFromPreambleAndH2(preamble, [sec])
          : `## ${sec.title}\n\n${sec.body}`.trim();
      return {
        relPath: `${baseDir}/${stem}-sec-${idx}-${slugSegment(sec.title)}.md`,
        markdown: stripBoilerplate(md),
        pendingBasename,
      };
    });
  }
  if (h2sections.length === 1) {
    const md = rebuildFromPreambleAndH2(preamble, h2sections);
    const [a, b] = splitTwoWays(md);
    return [
      { relPath: `${baseDir}/${stem}-part-01.md`, markdown: a, pendingBasename },
      { relPath: `${baseDir}/${stem}-part-02.md`, markdown: b, pendingBasename },
    ];
  }
  const [a, b] = splitTwoWays(preamble);
  return [
    { relPath: `${baseDir}/${stem}-part-01.md`, markdown: a, pendingBasename },
    { relPath: `${baseDir}/${stem}-part-02.md`, markdown: b, pendingBasename },
  ];
}

/**
 * Infer a **sort key** (seconds since epoch) from git / GitHub paper trail for one path. Not persisted and not part of
 * `PendingEntry` — used only while sequencing (see **Ordering when multiple pending files apply** in the reconciliation slice).
 *
 * **Sources:** GitHub Contents API when `useApi` and token/network succeed (needed when **shallow** clones lack full
 * history for `git log --diff-filter=A`), else first-add timestamp from `git log` on the local clone. If both fail,
 * returns **0** (unknown; such paths sort last among pending).
 */
async function paperTrailSortKeySecondsForPath(
  repoDir: string,
  rel: string,
  source: string | null,
  useApi: boolean,
  retryLog?: RetryLogContext
): Promise<number> {
  if (useApi && source) {
    const headSha = runSoft("git", ["-C", repoDir, "rev-parse", "HEAD"]);
    if (headSha.ok && headSha.stdout?.trim()) {
      const epoch = await getFileAddEpochViaApi(source, rel, headSha.stdout.trim(), retryLog);
      if (epoch > 0) return epoch;
    }
  }
  const out = runSoft("git", ["-C", repoDir, "log", "-1", "--format=%ct", "--diff-filter=A", "--", rel]);
  const ct = out.ok && out.stdout ? parseInt(out.stdout.trim(), 10) : 0;
  return isNaN(ct) ? 0 : ct;
}

function comparePaperTrailSortKeys(a: number, b: number): number {
  return a === 0 ? (b === 0 ? 0 : 1) : b === 0 ? -1 : a - b;
}

/**
 * Lists pending markdown under `knowledge/_pending/` and returns them in **paper-trail order** (earliest introduction
 * first): sort keys from GitHub API and/or `git log` as above — **not** a stored field on each entry.
 */
export async function sequencePendingByPaperTrail(
  repoDir: string,
  retryLog?: RetryLogContext
): Promise<PendingEntry[]> {
  const pendingPath = path.join(repoDir, PENDING_DIR);
  if (!existsSync(pendingPath)) return [];
  const files = readdirSync(pendingPath).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return [];

  const remoteUrl = getRemoteOriginUrl(repoDir);
  const useApi = !!(remoteUrl && parseGithubSource(remoteUrl));

  const rows: { path: string; content: string; sortKey: number }[] = [];
  for (const f of files) {
    const rel = `${PENDING_DIR}/${f}`;
    const fullPath = path.join(repoDir, rel);
    if (!existsSync(fullPath)) continue;
    let content: string;
    try {
      content = readFileSync(fullPath, "utf8");
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : "";
      if (code === "ENOENT") continue;
      throw e;
    }
    const sortKey = await paperTrailSortKeySecondsForPath(repoDir, rel, remoteUrl, useApi, retryLog);
    rows.push({ path: rel, content, sortKey });
  }
  rows.sort((x, y) => comparePaperTrailSortKeys(x.sortKey, y.sortKey));
  return rows.map(({ path: p, content }) => ({ path: p, content }));
}

function walkMarkdownFiles(dir: string, baseRel: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = baseRel ? `${baseRel}/${name.name}` : name.name;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "_pending") continue;
      walkMarkdownFiles(full, rel, out);
    } else if (name.isFile() && name.name.endsWith(".md")) {
      out.push(rel.replace(/\\/g, "/"));
    }
  }
}

/** List all corpus .md files under knowledge/ (recursive), excluding _pending. */
export function listCorpusMarkdownRelPaths(repoDir: string): string[] {
  const root = path.join(repoDir, KNOWLEDGE_DIR);
  const out: string[] = [];
  walkMarkdownFiles(root, "", out);
  return out.map((p) => `${KNOWLEDGE_DIR}/${p}`.replace(/\\/g, "/"));
}

function appendSourcesSection(markdown: string, sources: string[]): string {
  const uniq = [...new Set(sources)].sort();
  const block = `\n\n## Sources\n\n${uniq.map((s) => `- \`${s}\``).join("\n")}`;
  const t = markdown.trimEnd();
  if (/\n## Sources\n/.test(t)) {
    return `${t}\n${uniq.map((s) => `- \`${s}\``).join("\n")}\n`;
  }
  return `${t}${block}\n`;
}

function isSubstantive(text: string): boolean {
  return stripBoilerplate(text).length > 0;
}

function validatePendingRepresented(entries: PendingEntry[], corpus: Map<string, string>): boolean {
  const union = [...corpus.values()].join("\n");
  for (const e of entries) {
    if (!isSubstantive(e.content)) continue;
    const base = path.basename(e.path);
    const withTicks = `\`${base}\``;
    if (union.includes(withTicks)) continue;
    // LLMs sometimes list Sources as `- basename.md` without backticks; still attributable.
    if (/\n## Sources\n/i.test(union) && union.includes(base)) continue;
    return false;
  }
  return true;
}

/** Spec: MUST NOT integrate only into knowledge/<topic>.md keyed solely by first heading (single-file shortcut). */
export function violatesSingleTopicFileShortcut(entry: PendingEntry, corpus: Map<string, string>): boolean {
  if (!isSubstantive(entry.content)) return false;
  const topic = extractTopic(entry.content, path.basename(entry.path));
  const singlePath = `knowledge/${topic}.md`;
  const base = path.basename(entry.path);
  const needle = `\`${base}\``;
  const pathsWithSource: string[] = [];
  for (const [rel, text] of corpus.entries()) {
    if (text.includes(needle)) pathsWithSource.push(rel);
  }
  return pathsWithSource.length === 1 && pathsWithSource[0] === singlePath;
}

/**
 * Unit-test helper: deterministic multi-file decomposition, incoming-wins stripping, ## Sources.
 * Not used by `reconcile()`; tests call it directly to lock helper behavior.
 */
export function buildCorpusDeterministicIntegrate(
  repoDir: string,
  entries: PendingEntry[],
): LlmCorpusResult {
  const planned: PlannedChunk[] = [];
  for (const e of entries) {
    const chunks = decomposePendingEntry(e);
    if (chunks.length < 2) {
      return {
        ok: false,
        message: "internal: decomposition must yield at least two corpus files per pending item",
      };
    }
    planned.push(...chunks);
  }

  const incomingKeys = new Set<string>();
  for (const p of planned) {
    for (const k of collectH2Keys(p.markdown)) incomingKeys.add(k);
  }

  const corpusPaths = listCorpusMarkdownRelPaths(repoDir);
  const corpus = new Map<string, string>();
  for (const rel of corpusPaths) {
    const full = path.join(repoDir, rel);
    corpus.set(rel, readFileSync(full, "utf8"));
  }

  for (const [rel, text] of [...corpus.entries()]) {
    const stripped = stripH2SectionsMatching(text, incomingKeys);
    if (!stripped.trim()) {
      corpus.delete(rel);
    } else {
      corpus.set(rel, stripped);
    }
  }

  const byPath = new Map<string, { body: string; sources: Set<string> }>();
  for (const p of planned) {
    const prev = byPath.get(p.relPath);
    const sources = prev?.sources ?? new Set<string>();
    sources.add(p.pendingBasename);
    const mergedBody = prev
      ? `${prev.body}\n\n---\n\n${p.markdown}`.trim()
      : p.markdown;
    byPath.set(p.relPath, { body: mergedBody, sources });
  }

  for (const [rel, { body, sources }] of byPath.entries()) {
    corpus.set(rel, appendSourcesSection(body, [...sources]));
  }

  if (!validatePendingRepresented(entries, corpus)) {
    return {
      ok: false,
      message:
        "reconcile: could not represent all substantive pending content in corpus (integration failed)",
    };
  }

  return { ok: true, corpus };
}

async function runLlmIntegration(
  repoDir: string,
  entries: PendingEntry[],
  corpusBefore: Map<string, string>,
  opts: ReconcileOptions,
): Promise<LlmCorpusResult> {
  if (opts.integrationOverride) {
    return await opts.integrationOverride(repoDir, entries, corpusBefore);
  }
  return await integrateCorpusWithOpenAi(entries, corpusBefore);
}

/**
 * Reconcile: LLM-backed integration (OpenAI); atomic commit or rollback on failure.
 */
export async function reconcile(
  repoDir: string,
  second?: RetryLogContext | ReconcileOptions,
): Promise<ReconcileResult | ReconcileError> {
  const opts = normalizeReconcileSecond(second);
  const retryLog = opts.retryLog;
  const oldSha = run("git", ["-C", repoDir, "rev-parse", "HEAD"]).trim();
  const entries = await sequencePendingByPaperTrail(repoDir, retryLog);
  if (entries.length === 0) {
    return { ok: true, oldSha, newSha: oldSha, touched: [], deleted: [] };
  }

  const knowledgePath = path.join(repoDir, KNOWLEDGE_DIR);
  if (!existsSync(knowledgePath)) {
    const parent = path.dirname(knowledgePath);
    if (!existsSync(parent)) {
      return {
        ok: false,
        message: "knowledge/ parent directory does not exist",
        unresolved: entries.map((e) => e.path),
      };
    }
    mkdirSync(knowledgePath, { recursive: true });
  }

  const corpusPaths = listCorpusMarkdownRelPaths(repoDir);
  const corpusBefore = new Map<string, string>();
  for (const rel of corpusPaths) {
    const full = path.join(repoDir, rel);
    corpusBefore.set(rel, readFileSync(full, "utf8"));
  }

  const integrated = await runLlmIntegration(repoDir, entries, corpusBefore, opts);
  if (!integrated.ok) {
    return {
      ok: false,
      message: integrated.message,
      unresolved: entries.map((e) => e.path),
    };
  }

  const corpus = integrated.corpus;

  if (!validatePendingRepresented(entries, corpus)) {
    return {
      ok: false,
      message:
        "reconcile: could not represent all substantive pending content in corpus (integration failed)",
      unresolved: entries.map((e) => e.path),
    };
  }

  for (const e of entries) {
    if (violatesSingleTopicFileShortcut(e, corpus)) {
      return {
        ok: false,
        message:
          "reconcile: integration must not use single-file knowledge/<topic>.md shortcut per the reconciliation slice under specs/",
        unresolved: entries.map((x) => x.path),
      };
    }
  }

  const snapshotPaths = new Set([...corpusPaths, ...corpus.keys()]);
  const snapshot = new Map<string, string | null>();
  for (const rel of snapshotPaths) {
    const full = path.join(repoDir, rel);
    snapshot.set(rel, existsSync(full) ? readFileSync(full, "utf8") : null);
  }

  const pendingSnapshot = entries.map((e) => ({
    rel: e.path,
    content: readFileSync(path.join(repoDir, e.path), "utf8"),
  }));

  const touched: string[] = [];
  try {
    for (const [rel, content] of corpus.entries()) {
      const full = path.join(repoDir, rel);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, content.endsWith("\n") ? content : `${content}\n`, "utf8");
      touched.push(rel);
    }

    for (const rel of corpusPaths) {
      if (!corpus.has(rel)) {
        const full = path.join(repoDir, rel);
        if (existsSync(full)) rmSync(full);
      }
    }

    for (const p of pendingSnapshot) {
      const full = path.join(repoDir, p.rel);
      if (existsSync(full)) rmSync(full);
    }

    run("git", ["-C", repoDir, "add", "-A", PENDING_DIR, KNOWLEDGE_DIR]);
    run("git", ["-C", repoDir, "commit", "-m", `gl: reconcile ${entries.length} pending (integrated corpus)`]);
    const newSha = run("git", ["-C", repoDir, "rev-parse", "HEAD"]).trim();

    const deleted = entries.map((e) => e.path);
    return {
      ok: true,
      oldSha,
      newSha,
      touched: [...new Set(touched)].sort(),
      deleted,
    };
  } catch (e) {
    for (const [rel, prev] of snapshot.entries()) {
      const full = path.join(repoDir, rel);
      try {
        if (prev === null) {
          if (existsSync(full)) rmSync(full);
        } else {
          mkdirSync(path.dirname(full), { recursive: true });
          writeFileSync(full, prev, "utf8");
        }
      } catch {
        /* best-effort rollback */
      }
    }
    for (const p of pendingSnapshot) {
      try {
        const full = path.join(repoDir, p.rel);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, p.content, "utf8");
      } catch {
        /* best-effort rollback */
      }
    }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `reconcile failed: ${msg}`,
      unresolved: entries.map((x) => x.path),
    };
  }
}
