#!/usr/bin/env -S deno run -A
/**
 * Giterloper MCP server over HTTP/SSE (Streamable HTTP).
 * No stdio transport. See docs/MCP_API_CONTRACT.md.
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
import type { GlState, Pin } from "./types.ts";
import { mutatePins, readPins, resolvePin, SESSION_PIN_NAME, validatePinName } from "./pinned.ts";
import { makeQueueFilename, safeName } from "./add-queue.ts";
import { search as memsearchSearch } from "./memsearch-adapter.ts";
import { mergeBranchesRemotely, parseGithubSource } from "./github.ts";
import { mapErrorToMcp } from "./mcp-error-mapping.ts";
import { isInsecureMode, mcpAuthMiddleware } from "./mcp-auth.ts";
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
import {
  getSessionTtlMs,
  removeSessionData,
  scavengeStaleSessions,
  touchSession,
} from "./mcp-session-store.ts";
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
}

/**
 * Creates the shared MCP server (tool registration, session resolution). Use from HTTP or stdio entrypoints.
 * Options.getSessionId allows transport-specific session identity (e.g. stdio: process-scoped id).
 */
export function createServer(options?: CreateServerOptions): McpServer {
  const server = new McpServer({
    name: "giterloper",
    version: "1.0.0",
  });

  function resolveSessionId(extra: { sessionId?: string } | undefined): string {
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

  /** Resolves session-scoped state for MCP tool calls. Requires valid sessionId. */
  function stateForSession(
    extra: { sessionId?: string } | undefined
  ): ReturnType<typeof makeState> {
    const sessionId = resolveSessionId(extra);
    const state = makeState(sessionId);
    ensureSessionDir(state);
    autoInitSessionPin(state);
    touchSession(sessionId);
    return state;
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

  server.registerTool(
    "giterloper_search",
    {
      title: "Search knowledge",
      description:
        "Search knowledge at a pinned version. Returns paths, titles, snippets, scores.",
      inputSchema: z.object({
        pin: z.string().optional().describe("Pin name; omit to use session pin (_session)"),
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
        const p = resolvePin(state, pin ?? undefined);
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
        "Retrieve content by path at a pinned version.",
      inputSchema: z.object({
        pin: z.string().optional().describe("Pin name; omit to use session pin (_session)"),
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
        const p = resolvePin(state, pin ?? undefined);
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
        "Queue new knowledge into knowledge/_pending/. Equivalent to CLI gl insert.",
      inputSchema: z.object({
        pin: z.string().optional().describe("Pin name; omit to use session pin (_session)"),
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
        const p = resolvePin(state, pin ?? undefined);
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
        pushBranchOrFail(dir, p, "insert");
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
        "Process knowledge/_pending into topic files under knowledge/. Groups by topic, adds Sources, deletes pending only after content is represented. Equivalent to CLI gl reconcile.",
      inputSchema: z.object({
        pin: z.string().optional().describe("Pin name; omit to use session pin (_session)"),
      }),
    },
    async ({ pin }, extra) =>
      wrapTool(async () => {
        const state = stateForSession(extra);
        const p = resolvePin(state, pin ?? undefined);
        requirePinBranch(p, "reconcile_pending");
        const dir = ensureWorkingClone(state, p, {});
        assertBranchFresh(state, p, dir);
        const oldSha = p.sha;
        const result = await reconcile(dir);
        if (!result.ok) {
          return {
            ok: false,
            code: "invalid_argument",
            message: result.message,
            details: { unresolved: result.unresolved ?? [] },
          };
        }
        if (result.touched.length > 0 || result.deleted.length > 0) {
          pushBranchOrFail(dir, p, "reconcile");
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
        "Merge source pin's branch into target pin's branch via GitHub API. Equivalent to CLI gl merge. Omit one side to use session pin (_session).",
      inputSchema: z.object({
        sourcePin: z.string().optional().describe("Source pin; omit to use session pin (_session)"),
        targetPin: z.string().optional().describe("Target pin; omit to use session pin (_session)"),
      }),
    },
    async ({ sourcePin, targetPin }, extra) =>
      wrapTool(async () => {
        const state = stateForSession(extra);
        // Per docs/PIN_SETTING_PARAM_BEHAVIOR.md § Merge Tool Exception: both omitted → merge into itself.
        if (!sourcePin?.trim() && !targetPin?.trim()) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "Cannot merge a pin into itself. Omit at most one of sourcePin or targetPin (whichever resolves to the session pin).",
            details: {},
          };
        }
        const source = resolvePin(state, sourcePin ?? undefined);
        const target = resolvePin(state, targetPin ?? undefined);
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
          commitMessage
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

  const PIN_SET_ALLOWED = new Set(["pin", "source", "ref", "branch"]);
  server.registerTool(
    "giterloper_pin_set",
    {
      title: "Configure pins",
      description:
        "Configure pins per docs/PIN_SETTING_PARAM_BEHAVIOR.md. Omit pin = operate on session pin (name _session). Pin name = add or change that named pin. Must specify at least one of branch or ref. ref may be a SHA or branch/tag; resolved to SHA from remote. Pins store name, sha, optionally branch.",
      inputSchema: z
        .object({
          pin: z.string().optional().describe("Pin name; omit for session pin (_session)"),
          source: z
            .string()
            .optional()
            .describe("Repo source (required when creating the first pin; e.g. github.com/owner/repo)"),
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
            message: `Unknown arguments: ${unknown.join(", ")}. Allowed: pin, source, ref, branch.`,
            details: {},
          };
        }
        const str = (v: unknown): string | undefined =>
          v === undefined || v === null ? undefined : typeof v === "string" ? v : undefined;
        const pin = str(raw.pin);
        const source = str(raw.source);
        const ref = str(raw.ref);
        const branch = str(raw.branch);
        const state = stateForSession(extra);
        const pins = readPins(state);

        // Omit pin: operate on session pin. Per docs/PIN_SETTING_PARAM_BEHAVIOR.md.
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
                message: "No session pin (_session) configured. Set KNOWLEDGE_STORE_REMOTE or use pin_set with source and branch/ref to create it.",
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

          // Need session pin or source to create.
          if (!sessionPin && !source?.trim()) {
            return {
              ok: false,
              code: "invalid_argument",
              message: "No session pin (_session) configured. Use pin_set with source and branch or ref to create it.",
              details: {},
            };
          }
          if (!sessionPin) {
            const effectiveSource = source!.trim();
            const effectiveSha = shaProvided
              ? await resolveShaOrRef(effectiveSource, ref!.trim())
              : resolveSha(effectiveSource, "HEAD");
            const branchVal = branchProvided ? branch!.trim() || undefined : undefined;
            sessionPin = {
              name: SESSION_PIN_NAME,
              source: effectiveSource,
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
          const effectiveSource = source?.trim() || sessionPin.source;
          if (!effectiveSource) {
            return {
              ok: false,
              code: "invalid_argument",
              message: "No pins configured. Use pin_set with pin and source to create the first pin.",
              details: {},
            };
          }
          const resolvedSha = await resolveShaOrRef(effectiveSource, ref!.trim());
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

        // Per docs/PIN_SETTING_PARAM_BEHAVIOR.md §4: neither branch nor ref for named pin → FAIL.
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
          const effectiveSource = source?.trim() || sessionPinForInheritance?.source;
          if (!effectiveSource) {
            return {
              ok: false,
              code: "invalid_argument",
              message: "No session pin (_session) configured. Create it first or provide source.",
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
            ? await resolveShaOrRef(effectiveSource, ref!.trim())
            : sessionPinForInheritance!.sha;
          const branchVal = branch!.trim() || undefined;
          const snapshotPin: Pin = {
            name: trimmedName,
            source: effectiveSource,
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
          const sourceProvided = source !== undefined && source?.trim() !== "";
          const refProvided = ref !== undefined && ref?.trim() !== "";

          if (sourceProvided) merged.source = source!.trim();

          if (refProvided || sourceProvided) {
            const src = merged.source;
            const refInput = refProvided ? ref!.trim() : "HEAD";
            merged.sha = await resolveShaOrRef(src, refInput);
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

        // Non-existent pin (no branch): create using session pin's source/sha when not provided, add at end
        const effectiveSource = source?.trim() || sessionPinForInheritance?.source;
        if (!effectiveSource) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "No session pin (_session) configured. Create it first or provide source.",
            details: {},
          };
        }
        const refInput = ref?.trim() || "HEAD";
        const effectiveSha =
          !sessionPinForInheritance || source?.trim() || ref?.trim()
            ? await resolveShaOrRef(effectiveSource, refInput)
            : sessionPinForInheritance.sha;
        const newPin = {
          name: trimmedName,
          source: effectiveSource,
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
        "List pins or verify clone health and branch freshness. Session pin is named _session and appears first when listing all.",
      inputSchema: z.object({
        pin: z
          .string()
          .optional()
          .describe("Pin name; omit to list all pins (session pin _session first)"),
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
            ...(state.sessionId && { sessionId: state.sessionId }),
            pins: [] as { name: string; source: string; sha: string; branch: string | null }[],
          };
        }
        if (!verify) {
          return {
            ok: true,
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
        removeSessionData(sessionId);
        return {
          ok: true,
          sessionId,
          action: "session_ended",
        };
      })
  );

  return server;
}

/** HTTP transport type for app wiring: handleRequest and optional DELETE session cleanup. */
interface HttpMcpTransport {
  handleRequest(req: Request): Promise<Response>;
}

/**
 * Builds the Hono app for MCP over HTTP/SSE: CORS, /health, /mcp with auth.
 * Caller creates transport and server, connects them, then passes transport here.
 */
export function createHttpMcpApp(transport: HttpMcpTransport): Hono {
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
    })
  );
  app.use("/mcp", mcpAuthMiddleware);
  app.all("/mcp", async (c) => {
    if (c.req.method === "DELETE") {
      const sessionId = c.req.header("mcp-session-id");
      removeSessionData(sessionId);
    }
    return transport.handleRequest(c.req.raw);
  });
  return app;
}

/** Single long-lived transport and server for session lifecycle. */
const mcpTransport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});
const mcpServer = createServer();
await mcpServer.connect(mcpTransport);
const app = createHttpMcpApp(mcpTransport);

/** Exported for session lifecycle tests. */
export { app as mcpApp };

/**
 * Creates a fresh MCP app with its own transport and server. Use in tests that need
 * an independent initialize (the shared mcpApp rejects a second initialize).
 */
export async function createMcpAppForTest(): Promise<ReturnType<typeof createHttpMcpApp>> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  const server = createServer();
  await server.connect(transport);
  return createHttpMcpApp(transport);
}

if (import.meta.main) {
  const insecure = isInsecureMode();
  const hasToken = !!Deno.env.get("MCP_TOKEN");
  const ttlMs = getSessionTtlMs();
  if (ttlMs > 0) {
    const intervalMs = Math.min(ttlMs / 4, 15 * 60 * 1000);
    setInterval(() => scavengeStaleSessions(ttlMs), intervalMs);
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
  Deno.serve({ port: PORT, hostname: HOST }, (req) => app.fetch(req));
}
