/**
 * MCP authentication and authorization baseline.
 * Token-based identity with policy hooks for read vs write tools.
 * Transport auth and tool read/write classification: MCP slice under `specs/`.
 */
import type { Context, Next } from "hono";
import { mcpCodeToHttpStatus } from "./mcp-error-mapping.ts";

/** Read-only tools (search, retrieve, inspect state). */
export const MCP_READ_TOOLS = [
  "giterloper_search",
  "giterloper_retrieve",
  "giterloper_state_inspect",
] as const;

/** Write tools (insert, reconcile_pending, merge). */
export const MCP_WRITE_TOOLS = [
  "giterloper_insert_pending",
  "giterloper_merge",
  "giterloper_reconcile_pending",
  "giterloper_pin_set",
] as const;

export type McpReadTool = (typeof MCP_READ_TOOLS)[number];
export type McpWriteTool = (typeof MCP_WRITE_TOOLS)[number];

export function isReadTool(name: string): name is McpReadTool {
  return (MCP_READ_TOOLS as readonly string[]).includes(name);
}

export function isWriteTool(name: string): name is McpWriteTool {
  return (MCP_WRITE_TOOLS as readonly string[]).includes(name);
}

/** Auth policy for MCP HTTP requests (explicit in tests; production reads env once via `readMcpAuthFromEnv`). */
export interface McpAuthRuntime {
  insecure: boolean;
  expectedToken: string | null;
}

export function readMcpAuthFromEnv(): McpAuthRuntime {
  const v = Deno.env.get("MCP_INSECURE");
  const insecure = v === "true" || v === "1";
  return {
    insecure,
    expectedToken: Deno.env.get("MCP_TOKEN") ?? null,
  };
}

/** @deprecated Prefer `readMcpAuthFromEnv().insecure` */
export function isInsecureMode(): boolean {
  return readMcpAuthFromEnv().insecure;
}

/** @deprecated Prefer `readMcpAuthFromEnv().expectedToken` */
export function getExpectedToken(): string | null {
  return readMcpAuthFromEnv().expectedToken;
}

/**
 * Extracts Bearer token from Authorization header.
 * Returns null if missing or malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

/**
 * Validates request auth. Returns true if allowed.
 * - insecure: allow all (local dev)
 * - expectedToken set: require Bearer token match
 * - Otherwise: deny
 */
export function validateAuth(
  authHeader: string | undefined,
  runtime: McpAuthRuntime
): boolean {
  if (runtime.insecure) {
    return true;
  }
  const expected = runtime.expectedToken;
  if (!expected) {
    return false;
  }
  const token = extractBearerToken(authHeader);
  return token !== null && token === expected;
}

/** Deterministic 401 error envelope per MCP contract. */
export const UNAUTHORIZED_ENVELOPE = {
  ok: false as const,
  code: "unauthorized" as const,
  message: "Authentication required",
  details: {} as Record<string, unknown>,
};

/**
 * Hono middleware factory: requires valid auth for MCP requests.
 * Returns 401 JSON with deterministic envelope on failure.
 */
export function createMcpAuthMiddleware(runtime: McpAuthRuntime) {
  return async function mcpAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
    if (validateAuth(c.req.header("Authorization"), runtime)) {
      return next();
    }
    const status = mcpCodeToHttpStatus("unauthorized");
    return c.json(UNAUTHORIZED_ENVELOPE, status as 401);
  };
}
