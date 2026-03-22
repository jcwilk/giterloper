/**
 * Session filesystem layout and MCP test mode resolution.
 * Normative: specs/core.md (session root), specs/MCP.md (modes, env vars, literal directory names).
 */
import path from "node:path";

/** Normal mode: session dirs under `<projectRoot>/.giterloper/<sessionId>/`. */
export const GITERLOPER_SESSION_BASE_NORMAL = ".giterloper" as const;

/** MCP test mode: session dirs under `<projectRoot>/.giterloper_test/<sessionId>/`. */
export const GITERLOPER_SESSION_BASE_TEST = ".giterloper_test" as const;

/** Knowledge remote env key when {@link resolveMcpTestMode} is false. */
export const KNOWLEDGE_STORE_REMOTE_ENV = "KNOWLEDGE_STORE_REMOTE";

/** Knowledge remote env key when {@link resolveMcpTestMode} is true. */
export const TEST_KNOWLEDGE_STORE_REMOTE_ENV = "TEST_KNOWLEDGE_STORE_REMOTE";

/**
 * MCP test mode is never inferred from environment. Production entrypoints use the
 * `--mcp-test-mode` CLI flag; in-process code passes an explicit boolean via `createServer` / `makeState`.
 *
 * @param override `true` / `false` from caller; when omitted, **normal mode** (`false`).
 */
export function resolveMcpTestMode(override?: boolean): boolean {
  return override === true;
}

export function sessionBaseSegment(
  mcpTestMode: boolean
): typeof GITERLOPER_SESSION_BASE_NORMAL | typeof GITERLOPER_SESSION_BASE_TEST {
  return mcpTestMode ? GITERLOPER_SESSION_BASE_TEST : GITERLOPER_SESSION_BASE_NORMAL;
}

export function giterloperSessionsRoot(projectRoot: string, mcpTestMode: boolean): string {
  return path.join(projectRoot, sessionBaseSegment(mcpTestMode));
}

/**
 * Effective configured knowledge remote for the active MCP mode.
 * `override === null` → no bootstrap remote. Non-null string uses trimmed value if non-empty.
 */
export function effectiveKnowledgeStoreRemote(
  mcpTestMode: boolean,
  override: string | null | undefined,
  env: Pick<typeof Deno.env, "get"> = Deno.env
): string | undefined {
  if (override === null) return undefined;
  if (override !== undefined) {
    const t = override.trim();
    return t.length > 0 ? t : undefined;
  }
  const key = mcpTestMode ? TEST_KNOWLEDGE_STORE_REMOTE_ENV : KNOWLEDGE_STORE_REMOTE_ENV;
  return env.get(key)?.trim() || undefined;
}

/**
 * Structural check for MCP startup (specs/MCP.md): non-empty remotes must look like a Git remote
 * before the server listens. Does not probe the network.
 */
export function isPlausibleKnowledgeStoreRemote(s: string): boolean {
  const t = s.trim();
  if (t.length < 4) return false;
  if (/[\r\n\x00]/.test(t)) return false;
  const lower = t.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      new URL(t);
      return true;
    } catch {
      return false;
    }
  }
  if (t.startsWith("git@") || lower.startsWith("ssh://")) return true;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(t)) return true;
  if (/github\.com[/:][A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(t)) return true;
  return false;
}
