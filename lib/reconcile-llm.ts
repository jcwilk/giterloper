/**
 * LLM-backed pending→corpus integration for reconcile (reconciliation slice under specs/).
 * OpenAI Chat Completions JSON mode. Optional HTTP VCR via `GITERLOPER_OPENAI_VCR` (see `reconcile-openai-vcr.ts`).
 */

import { getOpenAiVcrMode, openAiFetch } from "./reconcile-openai-vcr.ts";

/**
 * Wire payload for `integrateCorpusWithOpenAi` (mirrors `PendingEntry` in `reconcile.ts`; no circular import).
 *
 * - **`path` / `content`:** sent to the model inside `pendingItems` (after ordering).
 * - **`addEpoch`:** **not** sent on the wire. It is metadata so callers can carry git/API “when added” timestamps;
 *   `integrateCorpusWithOpenAi` defensively sorts by `addEpoch` (same rules as `comparePendingByAddEpoch` in
 *   `reconcile.ts`) so LLM input order matches commit-time order even if the array is shuffled.
 */
export interface PendingEntryForLlm {
  path: string;
  addEpoch: number;
  content: string;
}

/** Same ordering as `comparePendingByAddEpoch` in `reconcile.ts` — duplicated here to avoid importing `reconcile.ts`. */
function comparePendingEntryForLlm(a: PendingEntryForLlm, b: PendingEntryForLlm): number {
  return a.addEpoch === 0
    ? b.addEpoch === 0
      ? 0
      : 1
    : b.addEpoch === 0
      ? -1
      : a.addEpoch - b.addEpoch;
}

export interface LlmCorpusSuccess {
  ok: true;
  corpus: Map<string, string>;
}

export interface LlmCorpusFailure {
  ok: false;
  message: string;
}

export type LlmCorpusResult = LlmCorpusSuccess | LlmCorpusFailure;

export function getReconcileOpenAiApiKey(): string | undefined {
  const a = Deno.env.get("GITERLOPER_RECONCILE_OPENAI_API_KEY")?.trim();
  const b = Deno.env.get("OPENAI_API_KEY")?.trim();
  return a || b || undefined;
}

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

interface OpenAiFileRow {
  path: string;
  content: string;
}

function validateKnowledgePath(p: string): boolean {
  const n = p.replace(/\\/g, "/");
  if (!n.startsWith("knowledge/")) return false;
  if (n.includes("/_pending/") || n.includes("knowledge/_pending")) return false;
  if (n.includes("..")) return false;
  return n.endsWith(".md");
}

/**
 * Calls OpenAI to produce the full integrated corpus (recursive markdown under knowledge/, excluding _pending).
 */
export async function integrateCorpusWithOpenAi(
  entries: PendingEntryForLlm[],
  corpusBefore: Map<string, string>,
): Promise<LlmCorpusResult> {
  const apiKey = getReconcileOpenAiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      message:
        "reconcile: LLM integration requires an API key (set OPENAI_API_KEY or GITERLOPER_RECONCILE_OPENAI_API_KEY)",
    };
  }

  // When VCR is on, pin model and URL so tape hashes match across machines (ignore .env drift).
  const vcrOn = getOpenAiVcrMode() !== "off";
  const model = vcrOn
    ? "gpt-4o-mini"
    : (Deno.env.get("GITERLOPER_RECONCILE_OPENAI_MODEL")?.trim() || "gpt-4o-mini");
  const baseUrl = vcrOn
    ? OPENAI_CHAT_URL
    : (Deno.env.get("GITERLOPER_RECONCILE_OPENAI_BASE_URL")?.trim() || OPENAI_CHAT_URL);
  const url = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  // Source of truth for “when added” is git/API via `getPendingInCommitOrder` → `addEpoch`. Do not send epochs to the
  // model (keeps VCR bodies stable). Defensively sort by addEpoch so input order matches commit order even if callers
  // pass a shuffled array.
  const ordered = [...entries].sort(comparePendingEntryForLlm);
  const pendingPayload = ordered.map((e) => ({
    path: e.path,
    content: e.content,
  }));
  const corpusPayload = [...corpusBefore.entries()]
    .map(([p, content]) => ({ path: p, content }))
    .sort((a, b) => a.path.localeCompare(b.path, "en"));

  const system = `You are a knowledge corpus integrator. You MUST integrate pending markdown items into the durable corpus under knowledge/ (not knowledge/_pending/).

Rules (normative):
- Use LLM reasoning to merge, deduplicate, place, and revise corpus markdown across one or more files and subdirectories under knowledge/.
- When new pending content conflicts with existing corpus substance, treat pending as authoritative: revise or remove conflicting corpus passages.
- Conceptually merge pending into the corpus (gardening on write): weave content coherently, not a raw paste beside unrelated text.
- Every corpus file that receives integrated content MUST include a "## Sources" section listing contributing pending entry basenames as \`basename.md\` list items.
- Paths MUST be relative with forward slashes, under knowledge/, ending in .md, and MUST NOT point at knowledge/_pending/.
- Return ONLY valid JSON with shape: {"files":[{"path":"knowledge/...","content":"full markdown"}]}. The "files" array is the complete set of knowledge/**/*.md files that should exist after integration (excluding _pending). Omit files that should be deleted from the corpus.`;

  const user = JSON.stringify(
    {
      pendingItems: pendingPayload,
      existingCorpusMarkdownFiles: corpusPayload,
    },
    null,
    2,
  );

  let res: Response;
  try {
    res = await openAiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `reconcile: LLM request failed: ${msg}` };
  }

  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false,
      message: `reconcile: LLM API error (${res.status}): ${t.slice(0, 800)}`,
    };
  }

  let body: {
    choices?: { message?: { content?: string } }[];
  };
  try {
    body = await res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `reconcile: LLM response JSON parse failed: ${msg}` };
  }

  const raw = body.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    return { ok: false, message: "reconcile: empty LLM response content" };
  }

  let parsed: { files?: OpenAiFileRow[] };
  try {
    parsed = JSON.parse(raw) as { files?: OpenAiFileRow[] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `reconcile: LLM output JSON parse failed: ${msg}` };
  }

  const rows = parsed.files;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, message: "reconcile: LLM JSON must include a non-empty files array" };
  }

  const corpus = new Map<string, string>();
  for (const row of rows) {
    if (!row || typeof row.path !== "string" || typeof row.content !== "string") {
      return { ok: false, message: "reconcile: LLM files entries must have path and content strings" };
    }
    const p = row.path.replace(/\\/g, "/");
    if (!validateKnowledgePath(p)) {
      return { ok: false, message: `reconcile: invalid corpus path from LLM: ${p}` };
    }
    corpus.set(p, row.content);
  }

  return { ok: true, corpus };
}
