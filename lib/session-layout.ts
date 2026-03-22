/**
 * Session filesystem layout and MCP test mode resolution.
 * Normative: specs/core.md (session root), specs/MCP.md (modes, env vars, literal directory names).
 */
import path from "node:path";

/** Normal mode: session dirs under `<projectRoot>/.giterloper/<sessionId>/`. */
export const GITERLOPER_SESSION_BASE_NORMAL = ".giterloper" as const;

/** MCP test mode: session dirs under `<projectRoot>/.giterloper_test/<sessionId>/`. */
export const GITERLOPER_SESSION_BASE_TEST = ".giterloper_test" as const;

/** Primary env signal for MCP test mode (truthy → test layout + TEST_KNOWLEDGE_STORE_REMOTE). */
export const GITERLOPER_MCP_TEST_MODE_ENV = "GITERLOPER_MCP_TEST_MODE";

/** Knowledge remote env key when {@link resolveMcpTestMode} is false. */
export const KNOWLEDGE_STORE_REMOTE_ENV = "KNOWLEDGE_STORE_REMOTE";

/** Knowledge remote env key when {@link resolveMcpTestMode} is true. */
export const TEST_KNOWLEDGE_STORE_REMOTE_ENV = "TEST_KNOWLEDGE_STORE_REMOTE";

export function isTruthyEnvString(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const t = raw.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

export function resolveMcpTestModeFromEnv(
  env: Pick<typeof Deno.env, "get"> = Deno.env
): boolean {
  return isTruthyEnvString(env.get(GITERLOPER_MCP_TEST_MODE_ENV));
}

/**
 * @param override When defined, wins over {@link GITERLOPER_MCP_TEST_MODE_ENV} (in-process hook for `createServer` / tests).
 */
export function resolveMcpTestMode(override?: boolean): boolean {
  if (override !== undefined) return override;
  return resolveMcpTestModeFromEnv();
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
