/**
 * Optional corpus context retrieval for reconcile (reconciliation slice under specs/): memsearch **MAY**
 * supply relevant snippets before LLM integration. Retrieval is **best-effort** and never required for a successful run.
 *
 * **Test / integration entry point:** Pass **`retrieveCorpusContext`** on **`reconcile()`**’s options
 * (`ReconcileOptions` in `reconcile.ts`) to inject or stub snippets and exercise retrieval + LLM wiring without
 * relying only on decomposition helpers. For direct OpenAI payload tests, pass **`corpusContextSnippets`** to
 * **`integrateCorpusWithOpenAi`** (`reconcile-llm.ts`).
 *
 * **Production memsearch:** Set **`GITERLOPER_RECONCILE_USE_MEMSEARCH_CONTEXT=1`** (or **`true`**) and ensure
 * **`memsearch`** is on **`PATH`**; otherwise default retrieval is a no-op (empty snippets).
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { MEMSEARCH_CMD, probeMemsearchCliAvailable } from "./memsearch-adapter.ts";
import { runSoft } from "./run.ts";

/** Same fields as **`PendingEntry`** / **`PendingEntryForLlm`**; duplicated here to avoid importing `reconcile-llm`. */
export interface PendingEntryForContext {
  path: string;
  content: string;
}

export interface ReconcileCorpusContextSnippet {
  /** Repo-relative path (e.g. knowledge/foo.md) */
  path: string;
  title?: string;
  snippet: string;
  score?: number;
}

export type ReconcileCorpusContextRetriever = (
  repoDir: string,
  entries: PendingEntryForContext[],
  corpusBefore: Map<string, string>,
) => Promise<ReconcileCorpusContextSnippet[]>;

function envEnablesMemsearchContext(): boolean {
  const v = Deno.env.get("GITERLOPER_RECONCILE_USE_MEMSEARCH_CONTEXT")?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Short query string from pending markdown for memsearch. */
export function reconcileContextQueryFromPending(entries: PendingEntryForContext[]): string {
  if (entries.length === 0) return "";
  const raw = entries[0].content.replace(/\r\n/g, "\n").trim();
  const firstLine = raw.split("\n").find((l) => l.trim().length > 0) ?? "";
  const noHeading = firstLine.replace(/^#+\s*/, "").trim();
  const q = noHeading.slice(0, 400);
  return q || raw.slice(0, 200);
}

/**
 * Best-effort: build a temp knowledge tree from `corpusBefore`, index with memsearch, run search, delete temp.
 * Returns **[]** on any failure, missing CLI, empty corpus, or short query.
 */
export async function retrieveCorpusContextViaMemsearch(
  _repoDir: string,
  entries: PendingEntryForContext[],
  corpusBefore: Map<string, string>,
): Promise<ReconcileCorpusContextSnippet[]> {
  if (!envEnablesMemsearchContext()) return [];
  if (corpusBefore.size === 0) return [];

  const probe = probeMemsearchCliAvailable();
  if (!probe.ok) return [];

  const query = reconcileContextQueryFromPending(entries);
  if (!query.trim()) return [];

  const tmp = mkdtempSync(path.join(tmpdir(), "giterloper-reconcile-ms-"));
  const milvusUri = path.join(tmp, "reconcile_milvus.db");

  try {
    const knowledgeRoot = path.join(tmp, "knowledge");
    for (const [rel, content] of corpusBefore.entries()) {
      const full = path.join(tmp, rel);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, content, "utf8");
    }

    if (!existsSync(knowledgeRoot)) return [];

    const idx = runSoft(MEMSEARCH_CMD, ["index", knowledgeRoot, "--milvus-uri", milvusUri]);
    if (!idx.ok) return [];

    const topK = Deno.env.get("GITERLOPER_RECONCILE_MEMSEARCH_CONTEXT_TOP_K")?.trim() || "8";
    const sr = runSoft(MEMSEARCH_CMD, [
      "search",
      query,
      "--milvus-uri",
      milvusUri,
      "--json-output",
      "--top-k",
      topK,
    ]);
    if (!sr.ok) return [];

    let raw: unknown;
    try {
      raw = JSON.parse(sr.stdout || "[]");
    } catch {
      return [];
    }

    const arr = Array.isArray(raw) ? raw : [];
    const out: ReconcileCorpusContextSnippet[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const p = String(rec.source ?? "");
      const snippet = String(rec.content ?? "").slice(0, 800);
      if (!p || !snippet.trim()) continue;
      out.push({
        path: p.replace(/\\/g, "/"),
        title: rec.heading !== undefined ? String(rec.heading) : undefined,
        snippet,
        score: typeof rec.score === "number" ? rec.score : Number(rec.score ?? 0),
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}
