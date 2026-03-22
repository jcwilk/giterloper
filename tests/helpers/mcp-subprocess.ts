/**
 * Deno argv to spawn MCP entrypoints with memsearch bootstrapped (scripts/with-memsearch.ts),
 * matching deno.json mcp:* tasks so subprocesses work without a pre-activated venv.
 */
import path from "node:path";

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
