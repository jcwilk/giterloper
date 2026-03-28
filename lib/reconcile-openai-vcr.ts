/**
 * Optional HTTP record/replay for OpenAI Chat Completions used by `integrateCorpusWithOpenAi`
 * (`lib/reconcile-llm.ts`). Activated when `GITERLOPER_OPENAI_VCR` is set (see modes below).
 * Production / local runs: leave unset → real network only.
 *
 * Modes (`GITERLOPER_OPENAI_VCR`):
 * - `replay-only` — replay from tape only; missing tape throws (default for test harness).
 * - `record-new` — replay if tape exists; otherwise call the network and write a tape.
 * - `rerecord-all` — delete `tests/fixtures/openai-vcr/` once per `deno test` process group, then behave like `record-new` (cross-test-file isolates coordinate via `tests/fixtures/.openai-vcr-rerecord-once`; replay/record-new clears it on first fetch).
 *
 * Tapes: `tests/fixtures/openai-vcr/<sha256>.json`. The filename is the SHA-256 of method + URL + stable JSON body
 * (auth excluded). Each file stores `{ key, request, response }`: **response** is replayed; **request** is a snapshot of
 * the exact body sent (for debugging). Legacy tapes with only `{ status, headers, body }` at the top level still replay.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _libDir = path.dirname(fileURLToPath(import.meta.url));

export const OPENAI_VCR_ROOT = path.join(_libDir, "..", "tests", "fixtures", "openai-vcr");

/** Exclusive marker: first isolate/worker that creates it performs the rerecord-all directory wipe. */
const RERECORD_ONCE_MARKER = path.join(path.dirname(OPENAI_VCR_ROOT), ".openai-vcr-rerecord-once");

export type OpenAiVcrMode = "off" | "record-new" | "replay-only" | "rerecord-all";

export function getOpenAiVcrMode(): OpenAiVcrMode {
  const v = Deno.env.get("GITERLOPER_OPENAI_VCR")?.trim().toLowerCase();
  if (v === "record-new" || v === "replay-only" || v === "rerecord-all") return v;
  return "off";
}

let rerecordAllInitialized = false;

function sortKeysDeep(x: unknown): unknown {
  if (x === null || typeof x !== "object") return x;
  if (Array.isArray(x)) return x.map(sortKeysDeep);
  const o = x as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = sortKeysDeep(o[k]);
  }
  return out;
}

function stableBodyForHash(bodyText: string): string {
  try {
    return JSON.stringify(sortKeysDeep(JSON.parse(bodyText)));
  } catch {
    return bodyText;
  }
}

function tapeKey(method: string, url: string, bodyText: string): string {
  const h = createHash("sha256");
  h.update(`${method.toUpperCase()}\n${url}\n${stableBodyForHash(bodyText)}`);
  return h.digest("hex");
}

/** HTTP response slice replayed from a tape. */
export interface OpenAiVcrTapeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Full on-disk tape: **key** matches the filename stem; **request** is forensic (same **body** string as used for hashing).
 */
export interface OpenAiVcrTape {
  key: string;
  request: {
    method: string;
    url: string;
    /** Exact request body bytes sent to OpenAI (JSON string). */
    body: string;
  };
  response: OpenAiVcrTapeResponse;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function isTapeResponse(x: unknown): x is OpenAiVcrTapeResponse {
  if (!isRecord(x)) return false;
  return typeof x.status === "number" && typeof x.body === "string" && isRecord(x.headers);
}

/** Extract replayable response from v2 `{ key, request, response }` or legacy top-level response shape. */
export function responseFromTapeJson(raw: unknown): OpenAiVcrTapeResponse {
  if (!isRecord(raw)) {
    throw new Error("VCR tape: expected JSON object");
  }
  if (isTapeResponse(raw.response)) {
    return raw.response;
  }
  if (isTapeResponse(raw)) {
    return raw;
  }
  throw new Error("VCR tape: missing response (expected { response } or legacy { status, headers, body })");
}

function headersToPlain(h: Headers): Record<string, string> {
  const o: Record<string, string> = {};
  h.forEach((v, k) => {
    o[k] = v;
  });
  return o;
}

function tapeToResponse(t: OpenAiVcrTapeResponse): Response {
  const headers = new Headers();
  for (const [k, v] of Object.entries(t.headers)) {
    if (/^content-encoding$/i.test(k) || /^transfer-encoding$/i.test(k)) continue;
    headers.set(k, v);
  }
  return new Response(t.body, { status: t.status, headers });
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  if (typeof input === "string" || input instanceof URL) {
    const b = init?.body;
    if (b === undefined || b === null) return "";
    if (typeof b === "string") return b;
    if (b instanceof Uint8Array) return new TextDecoder().decode(b);
    if (b instanceof ArrayBuffer) return new TextDecoder().decode(b);
    if (typeof (b as Blob).arrayBuffer === "function") {
      return new TextDecoder().decode(await (b as Blob).arrayBuffer());
    }
    return "";
  }
  const req = input as Request;
  const b = init?.body;
  if (b !== undefined && b !== null) {
    if (typeof b === "string") return b;
    if (b instanceof Uint8Array) return new TextDecoder().decode(b);
    return new TextDecoder().decode(await new Request("", { body: b as BodyInit }).arrayBuffer());
  }
  return await req.clone().text();
}

function tapePathForKey(key: string): string {
  return path.join(OPENAI_VCR_ROOT, `${key}.json`);
}

function writeTapeAtomic(filePath: string, payload: OpenAiVcrTape | OpenAiVcrTapeResponse): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  renameSync(tmp, filePath);
}

/** Clears rerecord marker when not in rerecord-all so the next rerecord-all run can wipe tapes again. */
function clearRerecordMarkerIfInactive(): void {
  const mode = getOpenAiVcrMode();
  if (mode === "rerecord-all") return;
  try {
    if (existsSync(RERECORD_ONCE_MARKER)) unlinkSync(RERECORD_ONCE_MARKER);
  } catch {
    /* ignore */
  }
}

function ensureRerecordAllOnce(): void {
  const mode = getOpenAiVcrMode();
  if (mode !== "rerecord-all" || rerecordAllInitialized) return;
  try {
    writeFileSync(RERECORD_ONCE_MARKER, "1", { flag: "wx" });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : "";
    if (code === "EEXIST") {
      rerecordAllInitialized = true;
      return;
    }
    throw e;
  }
  try {
    rmSync(OPENAI_VCR_ROOT, { recursive: true });
  } catch {
    /* ignore */
  }
  mkdirSync(OPENAI_VCR_ROOT, { recursive: true });
  rerecordAllInitialized = true;
}

/**
 * Drop-in replacement for `fetch` for OpenAI chat/completions calls when VCR is enabled.
 * Otherwise delegates to `globalThis.fetch`.
 */
export async function openAiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const mode = getOpenAiVcrMode();
  if (mode === "off") {
    return globalThis.fetch(input, init);
  }

  const url = typeof input === "string"
    ? input
    : input instanceof URL
    ? input.href
    : (input as Request).url;
  const method = init?.method ??
    (typeof input !== "string" && !(input instanceof URL) ? (input as Request).method : "GET");

  if (!url.includes("chat/completions")) {
    return globalThis.fetch(input, init);
  }

  clearRerecordMarkerIfInactive();
  ensureRerecordAllOnce();

  if (!existsSync(OPENAI_VCR_ROOT)) {
    mkdirSync(OPENAI_VCR_ROOT, { recursive: true });
  }

  const bodyText = await readRequestBody(input, init);
  const key = tapeKey(method, url, bodyText);
  const filePath = tapePathForKey(key);

  if (mode === "replay-only") {
    if (!existsSync(filePath)) {
      throw new Error(
        `VCR replay-only: missing tape for ${method} ${url} (key ${key.slice(0, 12)}…). Run with GITERLOPER_OPENAI_VCR=record-new and a real API key to create it.`,
      );
    }
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    return tapeToResponse(responseFromTapeJson(raw));
  }

  if (mode === "record-new" || mode === "rerecord-all") {
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, "utf8"));
      return tapeToResponse(responseFromTapeJson(raw));
    }
    const res = await globalThis.fetch(input, init);
    const text = await res.clone().text();
    const response: OpenAiVcrTapeResponse = {
      status: res.status,
      headers: headersToPlain(res.headers),
      body: text,
    };
    const full: OpenAiVcrTape = {
      key,
      request: {
        method,
        url,
        body: bodyText,
      },
      response,
    };
    writeTapeAtomic(filePath, full);
    return new Response(text, { status: res.status, headers: res.headers });
  }

  return globalThis.fetch(input, init);
}
