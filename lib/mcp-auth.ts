/**
 * MCP authentication and authorization baseline.
 * Token-based identity with policy hooks for read vs write tools.
 * See docs/MCP_API_CONTRACT.md, AGENTS.md § MCP server.
 */
import type { Context, Next } from "hono";

/** Read-only tools (search, retrieve, inspect state). */
export const MCP_READ_TOOLS = [
  "giterloper_search",
  "giterloper_retrieve",
  "giterloper_state_inspect",
] as const;

/** Write/reconcile tools. */
export const MCP_WRITE_TOOLS = [
  "giterloper_insert_pending",
  "giterloper_reconcile",
  "giterloper_reconcile_pending",
] as const;

export type McpReadTool = (typeof MCP_READ_TOOLS)[number];
export type McpWriteTool = (typeof MCP_WRITE_TOOLS)[number];

export function isReadTool(name: string): name is McpReadTool {
  return (MCP_READ_TOOLS as readonly string[]).includes(name);
}

export function isWriteTool(name: string): name is McpWriteTool {
  return (MCP_WRITE_TOOLS as readonly string[]).includes(name);
}

export function isInsecureMode(): boolean {
  const v = Deno.env.get("MCP_INSECURE");
  return v === "true" || v === "1";
}

export function getExpectedToken(): string | null {
  return Deno.env.get("MCP_TOKEN") ?? null;
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
 * - MCP_INSECURE=true: allow all (local dev)
 * - MCP_TOKEN set: require Bearer token match
 * - Otherwise: deny
 */
export function validateAuth(authHeader: string | undefined): boolean {
  if (isInsecureMode()) {
    return true;
  }
  const expected = getExpectedToken();
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
 * Hono middleware: requires valid auth for MCP requests.
 * Returns 401 JSON with deterministic envelope on failure.
 */
export async function mcpAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  if (validateAuth(c.req.header("Authorization"))) {
    return next();
  }
  return c.json(UNAUTHORIZED_ENVELOPE, 401);
}
