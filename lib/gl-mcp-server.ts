#!/usr/bin/env -S deno run -A
/**
 * Giterloper MCP server over HTTP/SSE (Streamable HTTP).
 * No stdio transport. See docs/MCP_API_CONTRACT.md.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { existsSync, writeFileSync } from "node:fs";

import { Hono } from "hono";
import { cors } from "hono/cors";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { makeState } from "./gl-core.ts";
import { readPins, resolvePin } from "./pinned.ts";
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
  ensureWorkingClone,
  pushBranchOrFail,
  requirePinBranch,
} from "./branch.ts";
import { updatePinSha, verifyCloneAtSha } from "./pin-lifecycle.ts";

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

function createServer(): McpServer {
  const state = makeState();
  const server = new McpServer({
    name: "giterloper",
    version: "1.0.0",
  });

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

  server.registerTool(
    "giterloper_search",
    {
      title: "Search knowledge",
      description:
        "Search knowledge at a pinned version. Returns paths, titles, snippets, scores.",
      inputSchema: z.object({
        pin: z.string().describe("Pin name (required)"),
        query: z.string().describe("Search query (required)"),
        sha: z
          .string()
          .regex(/^[0-9a-f]{40}$/i)
          .optional()
          .describe("Optional 40-char commit SHA; defaults to pin head"),
        limit: z.number().int().min(1).max(100).default(20).optional(),
      }),
    },
    async ({ pin, query, sha, limit }) =>
      wrapTool(() => {
        const p = resolvePin(state, pin);
        const effectiveSha = sha ?? p.sha;
        const pinAtSha = { ...p, sha: effectiveSha };
        const results = memsearchSearch(state, pin, effectiveSha, query, limit ?? 20, {
          buildOnDemand: true,
          pin: pinAtSha,
        });
        return {
          ok: true,
          pin,
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
        "Retrieve content by path or identifier at a pinned version.",
      inputSchema: z.object({
        pin: z.string().describe("Pin name (required)"),
        path: z
          .string()
          .optional()
          .describe(
            "Relative path within knowledge store (e.g. knowledge/foo.md)"
          ),
        id: z
          .string()
          .optional()
          .describe("Alternative: opaque identifier if indexing supports it"),
        sha: z
          .string()
          .regex(/^[0-9a-f]{40}$/i)
          .optional()
          .describe("Optional 40-char commit SHA; defaults to pin head"),
      }),
    },
    async ({ pin, path: filePath, id, sha }) =>
      wrapTool(() => {
        if (!filePath && !id) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "At least one of path or id must be provided",
            details: {},
          };
        }
        if (id && !filePath) {
          return {
            ok: false,
            code: "invalid_argument",
            message: "Retrieval by id not yet supported; use path for file retrieval",
            details: {},
          };
        }
        const p = resolvePin(state, pin);
        const effectiveSha = sha ?? p.sha;
        const content = retrieveFileContent(state, p, effectiveSha, filePath!);
        return {
          ok: true,
          pin,
          effectiveSha,
          path: filePath!,
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
        pin: z.string().describe("Pin name (required)"),
        content: z.string().describe("Markdown content to queue (required)"),
        name: z
          .string()
          .optional()
          .describe("Optional filename hint; server may generate if omitted"),
      }),
    },
    async ({ pin, content, name }) =>
      wrapTool(() => {
        const validationError = validateInsertContent(content);
        if (validationError) return validationError;
        const trimmed = (content ?? "").trim();
        const p = resolvePin(state, pin);
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
    "giterloper_reconcile",
    {
      title: "Reconcile pins",
      description:
        "Merge source pin's branch into target pin's branch via GitHub API. Equivalent to CLI gl merge.",
      inputSchema: z.object({
        sourcePin: z.string().describe("Source pin name (required)"),
        targetPin: z.string().describe("Target pin name (required)"),
      }),
    },
    async ({ sourcePin, targetPin }) =>
      wrapTool(async () => {
        const source = resolvePin(state, sourcePin);
        const target = resolvePin(state, targetPin);
        requirePinBranch(source, "reconcile");
        requirePinBranch(target, "reconcile");
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

  server.registerTool(
    "giterloper_state_inspect",
    {
      title: "Inspect pin state",
      description:
        "List pins or verify clone health and branch freshness.",
      inputSchema: z.object({
        pin: z
          .string()
          .optional()
          .describe("Optional pin name; omit to list all pins"),
        verify: z
          .boolean()
          .default(false)
          .optional()
          .describe("If true, include clone/health checks"),
      }),
    },
    async ({ pin, verify }) =>
      wrapTool(() => {
        const pins = pin ? [resolvePin(state, pin)] : readPins(state);
        if (pins.length === 0) {
          return { ok: true, pins: [] };
        }
        if (!verify) {
          return {
            ok: true,
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
        return { ok: true, checks };
      })
  );

  return server;
}

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
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createServer();
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

if (import.meta.main) {
  const insecure = isInsecureMode();
  const hasToken = !!Deno.env.get("MCP_TOKEN");
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
