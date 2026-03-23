#!/usr/bin/env -S deno run -A
/**
 * Giterloper MCP: registers tools in `createServer().server` and, when this file is the program
 * entrypoint, serves them over HTTP/SSE (`/health`, `/mcp`) via `Deno.serve`.
 */
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync, writeFileSync } from "node:fs";

import { Hono } from "hono";
import { cors } from "hono/cors";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { autoInitSessionPin, ensureSessionDir, makeState, validateSessionId } from "./gl-core.ts";
import { retryLogFromGlState } from "./retry-external.ts";
import type { GlState, Pin } from "./types.ts";
import { mutatePins, readPins, resolvePin, SESSION_PIN_NAME, validatePinName } from "./pinned.ts";
import { makeQueueFilename, safeName } from "./add-queue.ts";
import { probeMemsearchCliAvailable, search as memsearchSearch } from "./memsearch-adapter.ts";
import { mergeBranchesRemotely, parseGithubSource } from "./github.ts";
import { mapErrorToMcp } from "./mcp-error-mapping.ts";
import {
  createMcpAuthMiddleware,
  readMcpAuthFromEnv,
  type McpAuthRuntime,
} from "./mcp-auth.ts";
import { retrieveFileContent } from "./read-tools.ts";
import { cloneDir, ensureDir, stagedDir } from "./paths.ts";
import { run } from "./run.ts";
import {
  assertBranchFresh,
  branchFreshSoft,
  commitIfDirty,
  eagerPushBranchOrFail,
  ensureWorkingClone,
  pushBranchOrFail,
  requirePinBranch,
} from "./branch.ts";
import { clonePin, teardownPinData, updatePinSha, verifyCloneAtSha } from "./pin-lifecycle.ts";
import { reconcile } from "./reconcile.ts";
import { consumeBooleanFlag } from "./cli.ts";
import {
  getSessionTtlMs,
  isSafeSessionId,
  removeSessionData,
  scavengeStaleSessions,
  touchSession,
} from "./mcp-session-store.ts";
import {
  effectiveKnowledgeStoreRemote,
  isPlausibleKnowledgeStoreRemote,
  KNOWLEDGE_STORE_REMOTE_ENV,
  resolveMcpTestMode,
  TEST_KNOWLEDGE_STORE_REMOTE_ENV,
} from "./session-layout.ts";
import { resolveSha, resolveShaOrRef } from "./git.ts";

/** Validates insert_pending content. Returns MCP error envelope or null if valid. */
export function validateInsertContent(
  content: string | null | undefined
): { ok: false; code: "invalid_argument"; message: string; details: Record<string, unknown> } | null {
  const trimmed = (content ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "invalid_argument",
      message: "content must be non-empty",
      details: {},
    };
  }
  return null;
}

const PORT = (() => {
  const p = Deno.env.get("MCP_PORT");
  return p ? parseInt(p, 10) : 3443;
})();
const HOST = Deno.env.get("MCP_HOST") ?? "127.0.0.1";

export interface CreateServerOptions {
  /** Resolve session id from transport context. Default: validateSessionId(extra?.sessionId). */
  getSessionId?: (extra: { sessionId?: string } | undefined) => string;
  /**
   * When set (integration tests), MCP tool state uses this session directory instead of the transport id.
   * Otherwise `GITERLOPER_TEST_MCP_STATE_SESSION_ID` env is honored for spawned servers.
   */
  testFsSessionId?: string;
  /**
   * When set, selects MCP test mode (`.giterloper_test` + `TEST_KNOWLEDGE_STORE_REMOTE`) for this server.
   * Production entrypoints use the `--mcp-test-mode` CLI flag; stdio and HTTP MUST resolve parity the same way.
   */
  mcpTestMode?: boolean;
  /**
   * Session bootstrap remote for `_session` pin when unset: `undefined` → read env for active mode
   * (`KNOWLEDGE_STORE_REMOTE` vs `TEST_KNOWLEDGE_STORE_REMOTE`); `null` → do not auto-bootstrap; non-empty string → use as source.
   */
  knowledgeStoreRemote?: string | null;
  /**
   * Test-only: skip memsearch PATH probe (specs/MCP.md — narrow hook for startup failure tests).
   * Production entrypoints MUST NOT set this.
   */
  skipMemsearchVerification?: boolean;
}

/**
 * Returned by {@link createServer}: MCP server plus hooks for session pin bootstrap (specs/MCP.md).
 */
export interface McpServerBundle {
  server: McpServer;
  /**
   * Pass to `WebStandardStreamableHTTPServerTransport({ onsessioninitialized })` so `_session`
   * is created after HTTP `initialize` before any tool handler runs.
   */
  onHttpSessionInitialized: (sessionId: string) => void | Promise<void>;
  /** Call once after stdio `server.connect` so `_session` exists before any tool handler runs. */
  eagerBootstrapStdioSession: () => void;
}

/** Resolved after startup validation; used for /health and giterloper_state_inspect parity. */
export interface McpStartupSnapshot {
  mcpTestMode: boolean;
  configuredKnowledgeStoreRemote: string;
}

/**
 * Validates knowledge remote for the active mode (specs/MCP.md). Skips when
 * `knowledgeStoreRemote === null` (harness: no auto-bootstrap / optional env).
 */
export function mcpStartupState(
  options?: CreateServerOptions,
  env: Pick<typeof Deno.env, "get"> = Deno.env
): McpStartupSnapshot {
  const knowledgeRemoteOpt = options?.knowledgeStoreRemote;
  const mcpTestMode = resolveMcpTestMode(options?.mcpTestMode);
  const skipValidation = knowledgeRemoteOpt === null;
  const effective = effectiveKnowledgeStoreRemote(
    mcpTestMode,
    knowledgeRemoteOpt,
    env
  );
  const trimmed = effective?.trim() ?? "";
  if (!skipValidation) {
    const key = mcpTestMode
      ? TEST_KNOWLEDGE_STORE_REMOTE_ENV
      : KNOWLEDGE_STORE_REMOTE_ENV;
    if (!trimmed) {
      console.error(
        `giterloper MCP: ${key} must be set to a non-empty, valid Git remote (or pass knowledgeStoreRemote in createServer options).`
      );
      Deno.exit(1);
    }
    if (!isPlausibleKnowledgeStoreRemote(trimmed)) {
      console.error(
        `giterloper MCP: ${key} is not a usable Git remote: ${JSON.stringify(trimmed)}`
      );
      Deno.exit(1);
    }
  }
  if (!options?.skipMemsearchVerification) {
    const mem = probeMemsearchCliAvailable();
    if (!mem.ok) {
      console.error(`giterloper MCP: ${mem.message}`);
      Deno.exit(1);
    }
  }
  return {
    mcpTestMode,
    configuredKnowledgeStoreRemote: trimmed,
  };
}

/**
 * Creates the shared MCP server (tool registration, session resolution). Use from HTTP or stdio entrypoints.
 * Options.getSessionId allows transport-specific session identity (e.g. stdio: process-scoped id).
 */
export function createServer(options?: CreateServerOptions): McpServerBundle {
  const startup = mcpStartupState(options);
  const { mcpTestMode, configuredKnowledgeStoreRemote } = startup;
  const knowledgeRemoteOpt = options?.knowledgeStoreRemote;
  const testFsSessionOpt = options?.testFsSessionId;

  const server = new McpServer({
    name: "giterloper",
    version: "1.0.0",
  });

  function resolveSessionId(extra: { sessionId?: string } | undefined): string {
    const fromOpt = testFsSessionOpt?.trim();
    const testFsSession = fromOpt && isSafeSessionId(fromOpt)
      ? fromOpt
      : Deno.env.get("GITERLOPER_TEST_MCP_STATE_SESSION_ID")?.trim();
    if (testFsSession && isSafeSessionId(testFsSession)) {
      return testFsSession;
    }
    return options?.getSessionId
      ? options.getSessionId(extra)
      : validateSessionId(extra?.sessionId);
  }

  async function wrapTool<T>(
    fn: () => T | Promise<T>
  ): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    try {
      const result = await fn();
      const text =
        typeof result === "string"
          ? result
          : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      const mcp = mapErrorToMcp(e);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(mcp),
          },
        ],
        isError: true,
      };
    }
  }

  /** Normalize pin param: omit/blank → undefined for session pin. Per spec, explicit "_session" must fail. */
  function effectivePinForResolve(pin: string | null | undefined): string | undefined {
    if (!pin || typeof pin !== "string") return undefined;
    const t = pin.trim();
    if (t === "") return undefined;
    return pin; // Pass through "_session" so resolvePin's validatePinName rejects it.
  }

  /**
   * Session dir, `_session` bootstrap when configured, TTL touch. Idempotent; runs on HTTP session
   * activation (via {@link onHttpSessionInitialized}) and on each tool call.
   */
  function prepareSessionState(
    extra: { sessionId?: string } | undefined
  ): GlState {
    const sessionId = resolveSessionId(extra);
    const state = makeState(sessionId, { retryLogRole: "mcp", mcpTestMode });
    ensureSessionDir(state);
    autoInitSessionPin(state, knowledgeRemoteOpt);
    touchSession(sessionId, mcpTestMode);
    return state;
  }

  /** Resolves session-scoped state for MCP tool calls. Requires valid sessionId. */
  function stateForSession(
    extra: { sessionId?: string } | undefined
  ): GlState {
    return prepareSessionState(extra);
  }

  function onHttpSessionInitialized(sessionId: string): void {
    prepareSessionState({ sessionId });
  }

  function eagerBootstrapStdioSession(): void {
    prepareSessionState(undefined);
  }

  /** Augments success payload with session/pin metadata when available. */
  function withMetadata<T extends Record<string, unknown>>(
    state: GlState,
    payload: T
  ): T & { sessionId?: string } {
    if (state.sessionId) {
      return { ...payload, sessionId: state.sessionId };
    }
    return payload;
  }

  /** Parity with GET /health (specs/MCP.md — Observability). */
  function mcpObservabilityPayload(): {
    mcpTestMode: boolean;
    configuredKnowledgeStoreRemote: string;
  } {
    return { mcpTestMode, configuredKnowledgeStoreRemote };
  }

  server.registerTool(
    "giterloper_search",
    {
      title: "Search knowledge",
      description:
        "Search knowledge at a pinned version. Returns paths, titles, snippets, scores. Omit pin to use the session pin.",
      inputSchema: z.object({
        pin: z
          .string()
          .optional()
          .describe(
            'Pin name; omit for session pin. Do not pass the literal "_session" (reserved).'
          ),
        query: z.string().describe("Search query (required)"),
        sha: z
          .string()
          .regex(/^[0-9a-f]{40}$/i)
          .optional()
          .describe("Optional 40-char commit SHA; defaults to pin head"),
        limit: z.number().int().min(1).max(100).default(20).optional(),
      }),
    },
    async ({ pin, query, sha, limit }, extra) =>
      wrapTool(() => {
        const state = stateForSession(extra);
        const p = resolvePin(state, effectivePinForResolve(pin));
        const effectiveSha = sha ?? p.sha;
        const pinAtSha = { ...p, sha: effectiveSha };
        const results = memsearchSearch(state, p.name, effectiveSha, query, limit ?? 20, {
          buildOnDemand: true,
          pin: pinAtSha,
        });
        return {
          ok: true,
          ...(state.sessionId && { sessionId: state.sessionId }),
          pin: p.name,
          effectiveSha,
          results: results.map((r) => ({
            path: r.path,
            title: r.title,
            snippet: r.snippet,
            score: r.score,
          })),
        };
      })
  );

  server.registerTool(
    "giterloper_retrieve",
    {
      title: "Retrieve content",
      description:
        "Retrieve content by path at a pinned version. Omit pin to use the session pin.",
      inputSchema: z.object({
        pin: z
          .string()
          .optional()
          .describe(
            'Pin name; omit for session pin. Do not pass the literal "_session" (reserved).'
          ),
        path: z
          .string()
          .describe(
            "Relative path within knowledge store (e.g. knowledge/foo.md)"
          ),
        sha: z
          .string()
          .regex(/^[0-9a-f]{40}$/i)
          .optional()
          .describe("Optional 40-char commit SHA; defaults to pin head"),
      }),
    },
    async ({ pin, path: filePath, sha }, extra) =>
      wrapTool(() => {
        const state = stateForSession(extra);
        if (!filePath?.trim()) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "path is required",
            details: {},
          };
        }
        const p = resolvePin(state, effectivePinForResolve(pin));
        const effectiveSha = sha ?? p.sha;
        const content = retrieveFileContent(state, p, effectiveSha, filePath);
        return {
          ok: true,
          ...(state.sessionId && { sessionId: state.sessionId }),
          pin: p.name,
          effectiveSha,
          path: filePath,
          content,
        };
      })
  );

  server.registerTool(
    "giterloper_insert_pending",
    {
      title: "Insert pending knowledge",
      description:
        "Queue new knowledge into knowledge/_pending/. Equivalent to CLI gl insert. Omit pin to use the session pin.",
      inputSchema: z.object({
        pin: z
          .string()
          .optional()
          .describe(
            'Pin name; omit for session pin. Do not pass the literal "_session" (reserved).'
          ),
        content: z.string().describe("Markdown content to queue (required)"),
        name: z
          .string()
          .optional()
          .describe("Optional filename hint; server may generate if omitted"),
      }),
    },
    async ({ pin, content, name }, extra) =>
      wrapTool(() => {
        const state = stateForSession(extra);
        const validationError = validateInsertContent(content);
        if (validationError) return validationError;
        const trimmed = (content ?? "").trim();
        const p = resolvePin(state, effectivePinForResolve(pin));
        requirePinBranch(p, "insert_pending");
        const dir = ensureWorkingClone(state, p, {});
        assertBranchFresh(state, p, dir);
        const oldSha = p.sha;
        const folder = "knowledge/_pending";
        const fileName = makeQueueFilename(trimmed, name ?? null);
        const folderPath = path.join(dir, folder);
        ensureDir(folderPath);
        let outPath = path.join(folderPath, fileName);
        if (existsSync(outPath)) {
          const suffix = createHash("sha256")
            .update(trimmed)
            .digest("hex")
            .slice(0, 8);
          outPath = path.join(
            folderPath,
            `${safeName(fileName.replace(/\.md$/i, ""))}-${suffix}.md`
          );
        }
        writeFileSync(
          outPath,
          trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`,
          "utf8"
        );
        commitIfDirty(dir, `gl: insert ${path.basename(outPath)}`);
        pushBranchOrFail(dir, p, "insert", retryLogFromGlState(state));
        const newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
        updatePinSha(state, p.name, newSha, {});
        return {
          ok: true,
          ...(state.sessionId && { sessionId: state.sessionId }),
          action: "inserted",
          pin: p.name,
          branch: p.branch!,
          file: path.basename(outPath),
          oldSha,
          newSha,
        };
      })
  );

  server.registerTool(
    "giterloper_reconcile_pending",
    {
      title: "Reconcile pending knowledge",
      description:
        "Process knowledge/_pending into topic files under knowledge/. Groups by topic, adds Sources, deletes pending only after content is represented. Equivalent to CLI gl reconcile. Omit pin to use the session pin.",
      inputSchema: z.object({
        pin: z
          .string()
          .optional()
          .describe(
            'Pin name; omit for session pin. Do not pass the literal "_session" (reserved).'
          ),
      }),
    },
    async ({ pin }, extra) =>
      wrapTool(async () => {
        const state = stateForSession(extra);
        const p = resolvePin(state, effectivePinForResolve(pin));
        requirePinBranch(p, "reconcile_pending");
        const dir = ensureWorkingClone(state, p, {});
        assertBranchFresh(state, p, dir);
        const oldSha = p.sha;
        const result = await reconcile(dir, retryLogFromGlState(state));
        if (!result.ok) {
          return {
            ok: false,
            code: "invalid_argument",
            message: result.message,
            details: { unresolved: result.unresolved ?? [] },
          };
        }
        if (result.touched.length > 0 || result.deleted.length > 0) {
          pushBranchOrFail(dir, p, "reconcile", retryLogFromGlState(state));
          updatePinSha(state, p.name, result.newSha, {});
        }
        return {
          ok: true,
          ...(state.sessionId && { sessionId: state.sessionId }),
          action: "reconciled",
          pin: p.name,
          branch: p.branch!,
          oldSha: result.oldSha,
          newSha: result.newSha,
          touched: result.touched,
          deleted: result.deleted,
          unresolved: result.unresolved,
        };
      })
  );

  server.registerTool(
    "giterloper_merge",
    {
      title: "Merge pins",
      description:
        "Merge source pin's branch into target pin's branch via GitHub API. Equivalent to CLI gl merge. Omit at most one of sourcePin or targetPin to use the session pin for that side; omitting both fails.",
      inputSchema: z.object({
        sourcePin: z
          .string()
          .optional()
          .describe(
            'Source pin; omit for session pin. Do not pass the literal "_session" (reserved).'
          ),
        targetPin: z
          .string()
          .optional()
          .describe(
            'Target pin; omit for session pin. Do not pass the literal "_session" (reserved).'
          ),
      }),
    },
    async ({ sourcePin, targetPin }, extra) =>
      wrapTool(async () => {
        const state = stateForSession(extra);
        const effSource = effectivePinForResolve(sourcePin);
        const effTarget = effectivePinForResolve(targetPin);
        // Per specs/pin-semantics.md — Merge tool exception: both omitted → merge into itself.
        if (effSource === undefined && effTarget === undefined) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "Cannot merge a pin into itself. Omit at most one of sourcePin or targetPin (whichever resolves to the session pin).",
            details: {},
          };
        }
        const srcTrim = effSource?.trim() ?? "";
        const tgtTrim = effTarget?.trim() ?? "";
        if (srcTrim !== "" && srcTrim === tgtTrim) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "Cannot merge a pin into itself.",
            details: {},
          };
        }
        const source = resolvePin(state, effSource);
        const target = resolvePin(state, effTarget);
        if (source.name === target.name) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "Cannot merge a pin into itself.",
            details: {},
          };
        }
        requirePinBranch(source, "merge");
        requirePinBranch(target, "merge");
        if (source.source !== target.source) {
          throw new Error(
            `merge requires same repo: source "${source.name}" and target "${target.name}" point to different sources`
          );
        }
        if (!parseGithubSource(source.source)) {
          throw new Error("merge requires github.com source");
        }
        const commitMessage = `gl: merge ${source.name} into ${target.name}`;
        const result = await mergeBranchesRemotely(
          source.source,
          target.branch!,
          source.branch!,
          commitMessage,
          retryLogFromGlState(state)
        );
        const oldSha = target.sha;
        updatePinSha(state, target.name, result.sha, {});
        return {
          ok: true,
          ...(state.sessionId && { sessionId: state.sessionId }),
          action: "merged",
          source: {
            pin: source.name,
            branch: source.branch,
            sha: source.sha,
          },
          target: {
            pin: target.name,
            branch: target.branch,
            oldSha,
            newSha: result.sha,
          },
        };
      })
  );

  const PIN_SET_ALLOWED = new Set(["pin", "ref", "branch"]);

  /** Remote used for MCP pin_set git resolution: startup-configured store, else existing _session source (harness without bootstrap remote). */
  function mcpPinSetRepoRemote(pins: Pin[]): string | null {
    const cfg = configuredKnowledgeStoreRemote.trim();
    if (cfg.length > 0) return cfg;
    const session = pins.find((p) => p.name === SESSION_PIN_NAME);
    const s = session?.source?.trim();
    return s && s.length > 0 ? s : null;
  }

  server.registerTool(
    "giterloper_pin_set",
    {
      title: "Configure pins",
      description:
        "Configure pins per specs/pin-semantics.md. Repository identity is server-defined (KNOWLEDGE_STORE_REMOTE or TEST_KNOWLEDGE_STORE_REMOTE per mode); MCP inputs do not accept a repo/source override. Omit pin to operate on the session pin (stored as name _session); never pass pin=_session. With pin omitted and neither branch nor ref, returns the session pin. For named pins, specify at least one of branch or ref when adding or changing. ref may be a SHA or branch/tag; resolved to SHA from the configured remote. Pins store name, sha, optionally branch.",
      inputSchema: z
        .object({
          pin: z
            .string()
            .optional()
            .describe(
              'Named pin to add or update; omit for session pin. Do not pass the literal "_session" (reserved).'
            ),
          ref: z
            .string()
            .optional()
            .describe("SHA or ref (branch/tag); resolved from remote, stored as SHA"),
          branch: z
            .string()
            .optional()
            .describe("Branch for write ops; with ref creates branched pin"),
        })
        .strict(),
    },
    async (args, extra) =>
      wrapTool(async () => {
        const raw = (args ?? {}) as Record<string, unknown>;
        const unknown = Object.keys(raw).filter((k) => !PIN_SET_ALLOWED.has(k));
        if (unknown.length > 0) {
          return {
            ok: false,
            code: "invalid_argument",
            message: `Unknown arguments: ${unknown.join(", ")}. Allowed: pin, ref, branch.`,
            details: {},
          };
        }
        const str = (v: unknown): string | undefined =>
          v === undefined || v === null ? undefined : typeof v === "string" ? v : undefined;
        const pin = str(raw.pin);
        const ref = str(raw.ref);
        const branch = str(raw.branch);
        const state = stateForSession(extra);
        const rlog = retryLogFromGlState(state);
        const pins = readPins(state);

        // Omit pin: operate on session pin. Per specs/pin-semantics.md.
        if (!pin || pin.trim() === "") {
          const branchProvided = branch !== undefined && branch?.trim() !== "";
          const shaProvided = ref !== undefined && ref?.trim() !== "";
          let sessionPin = pins.find((p) => p.name === SESSION_PIN_NAME);

          // No modifiers: view session pin.
          if (!branchProvided && !shaProvided) {
            if (!sessionPin) {
              return {
                ok: false,
                code: "invalid_argument",
                message:
                  "No session pin (_session) configured. Set KNOWLEDGE_STORE_REMOTE (or TEST_KNOWLEDGE_STORE_REMOTE in MCP test mode) so the server can bootstrap the session pin.",
                details: {},
              };
            }
            return withMetadata(state, {
              ok: true,
              action: "pin_set",
              sessionPin: {
                name: sessionPin.name,
                source: sessionPin.source,
                sha: sessionPin.sha,
                branch: sessionPin.branch ?? null,
              },
              message: "Session pin",
            });
          }

          // Create _session when absent: requires a resolvable server-configured remote (or harness fallback).
          if (!sessionPin) {
            const repoRemote = mcpPinSetRepoRemote(pins);
            if (!repoRemote) {
              return {
                ok: false,
                code: "invalid_argument",
                message:
                  "No session pin (_session) configured and no effective knowledge remote is available. Set KNOWLEDGE_STORE_REMOTE (or TEST_KNOWLEDGE_STORE_REMOTE in MCP test mode) and restart the server, or rely on session bootstrap.",
                details: {},
              };
            }
            const effectiveSha = shaProvided
              ? await resolveShaOrRef(repoRemote, ref!.trim(), rlog)
              : resolveSha(repoRemote, "HEAD", rlog);
            const branchVal = branchProvided ? branch!.trim() || undefined : undefined;
            sessionPin = {
              name: SESSION_PIN_NAME,
              source: repoRemote,
              sha: effectiveSha,
              branch: branchVal,
            };
            clonePin(state, sessionPin);
            if (branchVal) eagerPushBranchOrFail(state, sessionPin);
            mutatePins(state, (list) => [sessionPin!, ...list]);
            return withMetadata(state, {
              ok: true,
              action: "pin_set",
              sessionPin: {
                name: sessionPin.name,
                source: sessionPin.source,
                sha: sessionPin.sha,
                branch: sessionPin.branch ?? null,
              },
              created: true,
              message: "Created session pin",
            });
          }
          if (branchProvided) {
            const updated: Pin = { ...sessionPin, branch: branch!.trim() || undefined };
            eagerPushBranchOrFail(state, updated);
            mutatePins(state, (list) =>
              list.map((p) => (p.name === SESSION_PIN_NAME ? updated : p))
            );
            return withMetadata(state, {
              ok: true,
              action: "pin_set",
              sessionPin: {
                name: updated.name,
                source: updated.source,
                sha: updated.sha,
                branch: updated.branch ?? null,
              },
              message: "Updated session pin branch",
            });
          }
          // ref only, no branch: update session pin to resolved ref SHA, branchlessly. Per doc §2.
          const repoRemote = mcpPinSetRepoRemote(pins) ?? sessionPin.source;
          if (!repoRemote?.trim()) {
            return {
              ok: false,
              code: "invalid_argument",
              message:
                "Cannot resolve ref: no effective knowledge remote. Set KNOWLEDGE_STORE_REMOTE (or TEST_KNOWLEDGE_STORE_REMOTE in MCP test mode).",
              details: {},
            };
          }
          const resolvedSha = await resolveShaOrRef(repoRemote, ref!.trim(), rlog);
          const updated: Pin = { ...sessionPin, sha: resolvedSha, branch: undefined };
          teardownPinData(state, sessionPin);
          clonePin(state, updated);
          mutatePins(state, (list) =>
            list.map((p) => (p.name === SESSION_PIN_NAME ? updated : p))
          );
          return withMetadata(state, {
            ok: true,
            action: "pin_set",
            sessionPin: {
              name: updated.name,
              source: updated.source,
              sha: updated.sha,
              branch: null,
            },
            message: "Updated session pin to ref (branchless)",
          });
        }

        validatePinName(pin);
        const trimmedName = pin.trim();
        const existing = pins.find((p) => p.name === trimmedName);
        const sessionPinForInheritance = pins.find((p) => p.name === SESSION_PIN_NAME);
        const branchProvided = branch !== undefined && branch?.trim() !== "";
        const shaProvided = ref !== undefined && ref?.trim() !== "";

        // Per specs/pin-semantics.md: neither branch nor ref for named pin → FAIL.
        if (!branchProvided && !shaProvided) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "Specify at least one of branch or ref when adding or changing a named pin.",
            details: {},
          };
        }

        // Branch + pin: create/update named pin. Per doc §1 (ref not specified) use session pin SHA; per doc §3 (ref specified) use resolved ref SHA.
        if (branchProvided) {
          const repoRemote = mcpPinSetRepoRemote(pins) ?? sessionPinForInheritance?.source;
          if (!repoRemote?.trim()) {
            return {
              ok: false,
              code: "invalid_argument",
              message:
                "No session pin (_session) configured and no effective knowledge remote. Set KNOWLEDGE_STORE_REMOTE (or TEST_KNOWLEDGE_STORE_REMOTE in MCP test mode) or ensure _session exists.",
              details: {},
            };
          }
          if (!shaProvided && !sessionPinForInheritance) {
            return {
              ok: false,
              code: "invalid_argument",
              message: "No session pin (_session) configured. Specify ref or create session pin first to inherit SHA.",
              details: {},
            };
          }
          const effectiveSha = shaProvided
            ? await resolveShaOrRef(repoRemote, ref!.trim(), rlog)
            : sessionPinForInheritance!.sha;
          const branchVal = branch!.trim() || undefined;
          const snapshotPin: Pin = {
            name: trimmedName,
            source: repoRemote,
            sha: effectiveSha,
            branch: branchVal,
          };
          if (existing) {
            const shaChanged = snapshotPin.sha !== existing.sha;
            const sourceChanged = snapshotPin.source !== existing.source;
            if (shaChanged || sourceChanged) {
              teardownPinData(state, existing);
              clonePin(state, snapshotPin);
            }
            try {
              eagerPushBranchOrFail(state, snapshotPin);
            } catch (e) {
              if (shaChanged || sourceChanged) teardownPinData(state, snapshotPin);
              throw e;
            }
            mutatePins(state, (list) =>
              list.map((p) => (p.name === trimmedName ? snapshotPin : p))
            );
            return {
              ok: true,
              ...(state.sessionId && { sessionId: state.sessionId }),
              action: "pin_set",
              pin: {
                name: snapshotPin.name,
                source: snapshotPin.source,
                sha: snapshotPin.sha,
                branch: snapshotPin.branch ?? null,
              },
              message: "Updated snapshot pin",
            };
          }
          clonePin(state, snapshotPin);
          try {
            eagerPushBranchOrFail(state, snapshotPin);
          } catch (e) {
            teardownPinData(state, snapshotPin);
            throw e;
          }
          mutatePins(state, (list) => {
            if (list.some((p) => p.name === trimmedName)) return list;
            return [...list, snapshotPin];
          });
          return {
            ok: true,
            ...(state.sessionId && { sessionId: state.sessionId }),
            action: "pin_set",
            pin: {
              name: snapshotPin.name,
              source: snapshotPin.source,
              sha: snapshotPin.sha,
              branch: snapshotPin.branch ?? null,
            },
            created: true,
            message: "Created snapshot pin",
          };
        }

        // Existing pin (no branch): merge provided fields in place, never reorder or change default
        if (existing) {
          const merged: Pin = { ...existing };
          const refProvided = ref !== undefined && ref?.trim() !== "";
          const repoRemote = mcpPinSetRepoRemote(pins) ?? existing.source;

          if (refProvided) {
            merged.source = configuredKnowledgeStoreRemote.trim() || existing.source;
            const refInput = ref!.trim();
            merged.sha = await resolveShaOrRef(repoRemote, refInput, rlog);
          }

          const shaChanged = merged.sha !== existing.sha;
          const sourceChanged = merged.source !== existing.source;
          if (shaChanged || sourceChanged) {
            teardownPinData(state, existing);
            clonePin(state, merged);
          }

          mutatePins(state, (list) =>
            list.map((p) => (p.name === trimmedName ? merged : p))
          );
          return {
            ok: true,
            ...(state.sessionId && { sessionId: state.sessionId }),
            action: "pin_set",
            pin: {
              name: merged.name,
              source: merged.source,
              sha: merged.sha,
              branch: merged.branch ?? null,
            },
          };
        }

        // Non-existent pin (no branch): create using server remote / session inheritance, add at end
        const repoRemote = mcpPinSetRepoRemote(pins) ?? sessionPinForInheritance?.source;
        if (!repoRemote?.trim()) {
          return {
            ok: false,
            code: "invalid_argument",
            message:
              "No session pin (_session) configured and no effective knowledge remote. Set KNOWLEDGE_STORE_REMOTE (or TEST_KNOWLEDGE_STORE_REMOTE in MCP test mode) or ensure _session exists.",
            details: {},
          };
        }
        const refInput = ref?.trim() || "HEAD";
        const effectiveSha =
          !sessionPinForInheritance || ref?.trim()
            ? await resolveShaOrRef(repoRemote, refInput, rlog)
            : sessionPinForInheritance.sha;
        const storedSource = configuredKnowledgeStoreRemote.trim() || repoRemote;
        const newPin = {
          name: trimmedName,
          source: storedSource,
          sha: effectiveSha,
          branch: branch?.trim() || undefined,
        };
        clonePin(state, newPin);
        mutatePins(state, (list) => {
          if (list.some((p) => p.name === trimmedName)) return list;
          return [...list, newPin];
        });
        return {
          ok: true,
          ...(state.sessionId && { sessionId: state.sessionId }),
          action: "pin_set",
          pin: {
            name: newPin.name,
            source: newPin.source,
            sha: newPin.sha,
            branch: newPin.branch ?? null,
          },
          created: true,
        };
      })
  );

  server.registerTool(
    "giterloper_state_inspect",
    {
      title: "Inspect pin state",
      description:
        "List pins or verify clone health and branch freshness. The session pin is stored as _session and appears first when listing all. Omit pin to list all pins.",
      inputSchema: z.object({
        pin: z
          .string()
          .optional()
          .describe(
            'Pin name to inspect one pin; omit to list all (_session appears first). Do not pass the literal "_session" (reserved).'
          ),
        verify: z
          .boolean()
          .default(false)
          .optional()
          .describe("If true, include clone/health checks"),
      }),
    },
    async ({ pin, verify }, extra) =>
      wrapTool(() => {
        const state = stateForSession(extra);
        const pins = pin ? [resolvePin(state, pin)] : readPins(state);
        if (pins.length === 0) {
          return {
            ok: true,
            ...mcpObservabilityPayload(),
            ...(state.sessionId && { sessionId: state.sessionId }),
            pins: [] as { name: string; source: string; sha: string; branch: string | null }[],
          };
        }
        if (!verify) {
          return {
            ok: true,
            ...mcpObservabilityPayload(),
            ...(state.sessionId && { sessionId: state.sessionId }),
            pins: pins.map((p) => ({
              name: p.name,
              source: p.source,
              sha: p.sha,
              branch: p.branch ?? null,
            })),
          };
        }
        const checks = pins.map((p) => {
          const cdir = cloneDir(state, p);
          const clonePresent = existsSync(cdir);
          const cloneShaOk = clonePresent ? verifyCloneAtSha(p, cdir) : false;
          const freshness = branchFreshSoft(state, p);
          const stagedPath = p.branch
            ? stagedDir(state, p.name, p.branch)
            : null;
          return {
            pin: p.name,
            branch: p.branch ?? null,
            sha: p.sha,
            clonePresent,
            cloneShaOk,
            workingCloneExists: stagedPath ? existsSync(stagedPath) : false,
            branchFresh: freshness.fresh,
          };
        });
        return {
          ok: true,
          ...mcpObservabilityPayload(),
          ...(state.sessionId && { sessionId: state.sessionId }),
          checks,
        };
      })
  );

  server.registerTool(
    "giterloper_session_end",
    {
      title: "End session",
      description:
        "Explicitly end the current MCP session and remove session-local state. Use when done with the session to free disk space.",
      inputSchema: z.object({}),
    },
    async (_, extra) =>
      wrapTool(() => {
        const sessionId = resolveSessionId(extra);
        removeSessionData(sessionId, mcpTestMode);
        return {
          ok: true,
          sessionId,
          action: "session_ended",
        };
      })
  );

  return { server, onHttpSessionInitialized, eagerBootstrapStdioSession };
}

/** HTTP transport type for app wiring: handleRequest and optional DELETE session cleanup. */
interface HttpMcpTransport {
  handleRequest(req: Request): Promise<Response>;
}

/**
 * Builds the Hono app for MCP over HTTP/SSE: CORS, /health, /mcp with auth.
 * Caller creates transport and server, connects them, then passes transport here.
 */
export function createHttpMcpApp(
  transport: HttpMcpTransport,
  authRuntime: McpAuthRuntime = readMcpAuthFromEnv(),
  sessionOpts?: {
    mcpTestMode?: boolean;
    configuredKnowledgeStoreRemote?: string;
  }
): Hono {
  const mcpTestModeForHttp = resolveMcpTestMode(sessionOpts?.mcpTestMode);
  const configuredRemoteForHealth =
    sessionOpts?.configuredKnowledgeStoreRemote ?? "";
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: (origin) => origin ?? "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "mcp-session-id",
        "Last-Event-ID",
        "mcp-protocol-version",
      ],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
    })
  );
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "giterloper-mcp",
      version: "1.0.0",
      mcpTestMode: mcpTestModeForHttp,
      configuredKnowledgeStoreRemote: configuredRemoteForHealth,
    })
  );
  app.use("/mcp", createMcpAuthMiddleware(authRuntime));
  app.all("/mcp", async (c) => {
    if (c.req.method === "DELETE") {
      const sessionId = c.req.header("mcp-session-id");
      removeSessionData(sessionId, mcpTestModeForHttp);
    }
    return transport.handleRequest(c.req.raw);
  });
  return app;
}

/**
 * Creates a fresh MCP app with its own transport and server. Use in tests that need
 * an independent initialize (the shared mcpApp rejects a second initialize).
 */
export type CreateMcpAppForTestOptions = CreateServerOptions & {
  auth?: McpAuthRuntime;
};

export async function createMcpAppForTest(
  opts?: CreateMcpAppForTestOptions
): Promise<ReturnType<typeof createHttpMcpApp>> {
  const { auth: authOpt, ...serverOpts } = opts ?? {};
  const mcpTestMode =
    serverOpts.mcpTestMode !== undefined ? serverOpts.mcpTestMode : true;
  const testStartup = mcpStartupState({ ...serverOpts, mcpTestMode });
  const { server, onHttpSessionInitialized } = createServer({
    ...serverOpts,
    mcpTestMode,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: onHttpSessionInitialized,
  });
  await server.connect(transport);
  const authRuntime = authOpt ?? readMcpAuthFromEnv();
  return createHttpMcpApp(transport, authRuntime, {
    mcpTestMode: testStartup.mcpTestMode,
    configuredKnowledgeStoreRemote: testStartup.configuredKnowledgeStoreRemote,
  });
}

/** When imported as a library (tests), no default HTTP server is built — use `createMcpAppForTest`. */
const libraryImportMcpStub = new Hono();
libraryImportMcpStub.all("*", (c) =>
  c.json(
    {
      ok: false,
      message:
        "gl-mcp-server.ts was imported as a library; use createMcpAppForTest or run this file as the program entrypoint.",
    },
    501
  )
);

let mcpApp: Hono = libraryImportMcpStub;

/** Exported for ad-hoc use; prefer `createMcpAppForTest` in tests (injected auth/bootstrap). */
export { mcpApp };

if (import.meta.main) {
  let argv = [...Deno.args];
  const mcpTestFlag = consumeBooleanFlag(argv, "--mcp-test-mode");
  argv = mcpTestFlag.args;
  if (argv.length > 0) {
    console.error(
      `giterloper MCP: unexpected argument(s): ${argv.map((a) => JSON.stringify(a)).join(" ")}`
    );
    Deno.exit(1);
  }
  const sharedMcpTestMode = mcpTestFlag.found;
  const httpStartup = mcpStartupState({ mcpTestMode: sharedMcpTestMode });
  const { server: mcpServer, onHttpSessionInitialized } = createServer({
    mcpTestMode: sharedMcpTestMode,
  });
  const mcpTransport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: onHttpSessionInitialized,
  });
  await mcpServer.connect(mcpTransport);
  const mcpAuthAtLoad = readMcpAuthFromEnv();
  mcpApp = createHttpMcpApp(mcpTransport, mcpAuthAtLoad, {
    mcpTestMode: httpStartup.mcpTestMode,
    configuredKnowledgeStoreRemote: httpStartup.configuredKnowledgeStoreRemote,
  });

  const { insecure, expectedToken } = readMcpAuthFromEnv();
  const hasToken = !!expectedToken;
  const ttlMs = getSessionTtlMs();
  if (ttlMs > 0) {
    const intervalMs = Math.min(ttlMs / 4, 15 * 60 * 1000);
    setInterval(() => scavengeStaleSessions(ttlMs, sharedMcpTestMode), intervalMs);
  }
  console.log(`Giterloper MCP server on http://${HOST}:${PORT}`);
  console.log(`  Health: http://${HOST}:${PORT}/health`);
  console.log(`  MCP:    http://${HOST}:${PORT}/mcp`);
  if (insecure) {
    console.log(`  Auth:   INSECURE (local dev only)`);
  } else if (hasToken) {
    console.log(`  Auth:   enabled (Bearer token)`);
  } else {
    console.log(`  Auth:   enabled (no MCP_TOKEN set; all MCP requests will be denied)`);
  }
  Deno.serve({ port: PORT, hostname: HOST }, (req) => mcpApp.fetch(req));
}
