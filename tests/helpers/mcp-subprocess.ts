/**
 * Deno argv to spawn MCP entrypoints with memsearch bootstrapped (scripts/with-memsearch.ts),
 * matching deno.json mcp:* tasks so subprocesses work without a pre-activated venv.
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

import { integrationMcpModeChildEnv } from "./integration-mcp-env.ts";
import { GITERLOPER_REPO_ROOT } from "./gl.ts";

function withMemsearchWrap(inner: string[]): string[] {
  return [
    "run",
    "-A",
    path.join(GITERLOPER_REPO_ROOT, "scripts", "with-memsearch.ts"),
    "--",
    ...inner,
  ];
}

/** HTTP MCP server (`lib/gl-mcp-server.ts`). */
export function denoArgsForMcpHttpServer(scriptArgs: string[] = []): string[] {
  return withMemsearchWrap([
    "run",
    "-A",
    path.join(GITERLOPER_REPO_ROOT, "lib", "gl-mcp-server.ts"),
    ...scriptArgs,
  ]);
}

/** Stdio MCP server (`lib/gl-mcp-server-stdio.ts`). */
export function denoArgsForMcpStdioServer(scriptArgs: string[] = []): string[] {
  return withMemsearchWrap([
    "run",
    "-A",
    path.join(GITERLOPER_REPO_ROOT, "lib", "gl-mcp-server-stdio.ts"),
    ...scriptArgs,
  ]);
}

export interface McpHttpIntegrationServerHandle {
  kill: () => void;
}

/** memsearch default embedder reads OPENAI_API_KEY; merge from repo `.env` if missing (without loading `.env` into the test runner — avoids breaking remote-unset startup cases). */
function mergeOpenAiKeyFromRepoDotenv(env: Record<string, string>): void {
  if (env.OPENAI_API_KEY) return;
  try {
    const dotenvPath = path.join(GITERLOPER_REPO_ROOT, ".env");
    const text = readFileSync(dotenvPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== "OPENAI_API_KEY") continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (val) env.OPENAI_API_KEY = val;
      break;
    }
  } catch {
    /* no .env */
  }
}

/**
 * Spawn HTTP MCP server (`lib/gl-mcp-server.ts`) with test-mode env. Pair with `waitForMcpHttpHealth`.
 * When `mcpStateSessionId` is set, the server aligns MCP pin state with that CLI session (see
 * `GITERLOPER_TEST_MCP_STATE_SESSION_ID`).
 */
export function spawnMcpHttpIntegrationServer(opts: {
  port: number;
  mcpStateSessionId?: string;
  projectRoot?: string;
}): McpHttpIntegrationServerHandle {
  const env: Record<string, string> = {
    ...Deno.env.toObject(),
    ...integrationMcpModeChildEnv(),
    MCP_PORT: String(opts.port),
    MCP_INSECURE: "true",
  };
  mergeOpenAiKeyFromRepoDotenv(env);
  if (opts.mcpStateSessionId != null && opts.mcpStateSessionId !== "") {
    env.GITERLOPER_TEST_MCP_STATE_SESSION_ID = opts.mcpStateSessionId;
  }
  if (opts.projectRoot != null && opts.projectRoot !== "") {
    env.GITERLOPER_PROJECT_ROOT = opts.projectRoot;
  }
  const proc = spawn(Deno.execPath(), denoArgsForMcpHttpServer(["--mcp-test-mode"]), {
    cwd: GITERLOPER_REPO_ROOT,
    env,
    stdio: ["ignore", "ignore", "ignore"],
  });
  return { kill: () => proc.kill("SIGTERM") };
}

/** Poll `/health` until OK or `timeoutMs`. */
export async function waitForMcpHttpHealth(port: number, timeoutMs = 8000): Promise<void> {
  const url = `http://127.0.0.1:${port}/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      await res.text();
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server not ready at ${url} within ${timeoutMs}ms`);
}
