/**
 * Session filesystem layout and MCP test mode resolution.
 * Normative: specs/core.md (session root), specs/mcp.md (modes, env vars, literal directory names).
 */
import path from "node:path";

import { EXIT, fail } from "./errors.ts";

/** Product root override (same semantics as `makeState` / specs/core.md). */
export const GITERLOPER_PROJECT_ROOT_ENV = "GITERLOPER_PROJECT_ROOT" as const;

/**
 * Optional MCP test session parent (basename-only override for `.giterloper_test` trees).
 * Ignored unless MCP test mode is active. See specs/core.md.
 */
export const GITERLOPER_MCP_TEST_SESSION_PARENT = "GITERLOPER_MCP_TEST_SESSION_PARENT" as const;

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
 * Resolves the product / repository root: trimmed non-empty `GITERLOPER_PROJECT_ROOT`, else absolute `cwd`.
 */
export function resolveProductRoot(
  env: Pick<typeof Deno.env, "get"> = Deno.env,
  cwd: () => string = () => Deno.cwd()
): string {
  const o = env.get(GITERLOPER_PROJECT_ROOT_ENV)?.trim();
  return o && o.length > 0 ? path.resolve(o) : path.resolve(cwd());
}

/**
 * Validates raw `GITERLOPER_MCP_TEST_SESSION_PARENT` and returns an absolute directory path.
 * Relative values resolve against `projectRootAnchor` (same basis as {@link resolveProductRoot}).
 */
export function resolveValidatedMcpTestSessionParent(
  rawTrimmed: string,
  projectRootAnchor: string
): string {
  const t = rawTrimmed.trim();
  if (!t) {
    fail(
      `${GITERLOPER_MCP_TEST_SESSION_PARENT} is empty after trim`,
      EXIT.STATE
    );
  }
  if (/[\r\n\x00]/.test(t)) {
    fail(
      `${GITERLOPER_MCP_TEST_SESSION_PARENT} contains invalid characters`,
      EXIT.STATE
    );
  }
  const segments = t.split(/[/\\]+/).filter((s) => s.length > 0);
  for (const seg of segments) {
    if (seg === "..") {
      fail(
        `${GITERLOPER_MCP_TEST_SESSION_PARENT} must not contain ".." path segments`,
        EXIT.STATE
      );
    }
  }
  return path.isAbsolute(t) ? path.resolve(t) : path.resolve(projectRootAnchor, t);
}

/** Optional per-call layout overrides (in-process MCP tests, `createServer`); see specs/core.md. */
export type McpSessionLayoutOpts = {
  /** Product root; when omitted, callers use {@link resolveProductRoot()} / env. */
  projectRoot?: string;
  /**
   * MCP test mode only: parent directory of the literal `.giterloper_test` segment.
   * When **provided** (including empty string after trim), overrides
   * {@link GITERLOPER_MCP_TEST_SESSION_PARENT} for that resolution. When **omitted** (`undefined`),
   * env is read as usual **unless** {@link McpSessionLayoutOpts.projectRoot} is set (non-empty trim),
   * in which case the session parent defaults to that product root (harness env ignored).
   */
  mcpTestSessionParent?: string;
};

/**
 * Resolves the optional 4th argument for {@link effectiveGiterloperSessionsRoot} from
 * {@link McpSessionLayoutOpts}: explicit `mcpTestSessionParent` wins; else non-empty `projectRoot`
 * implies default test sessions under that root (trim-empty override); else env applies.
 */
export function effectiveMcpTestSessionParentOverride(
  mcpTestMode: boolean,
  layout?: McpSessionLayoutOpts
): string | undefined {
  if (!mcpTestMode) return undefined;
  if (layout?.mcpTestSessionParent !== undefined) {
    return layout.mcpTestSessionParent;
  }
  const root = layout?.projectRoot?.trim();
  if (root && root.length > 0) {
    return "";
  }
  return undefined;
}

/**
 * Directory containing `.giterloper` or `.giterloper_test` session trees per mode and env
 * (matches `makeState` / MCP session store). In MCP test mode, optional
 * {@link GITERLOPER_MCP_TEST_SESSION_PARENT} relocates the parent of the literal `.giterloper_test` segment.
 *
 * When `mcpTestSessionParentOverride` is **defined**, it replaces the env var for this call
 * (trimmed empty → session tree under `projectRoot` / `.giterloper_test`).
 */
export function effectiveGiterloperSessionsRoot(
  projectRoot: string,
  mcpTestMode: boolean,
  env: Pick<typeof Deno.env, "get"> = Deno.env,
  mcpTestSessionParentOverride?: string
): string {
  if (!mcpTestMode) {
    return path.join(projectRoot, GITERLOPER_SESSION_BASE_NORMAL);
  }
  if (mcpTestSessionParentOverride !== undefined) {
    const t = mcpTestSessionParentOverride.trim();
    if (!t) {
      return path.join(projectRoot, GITERLOPER_SESSION_BASE_TEST);
    }
    const sessionsParent = resolveValidatedMcpTestSessionParent(t, projectRoot);
    return path.join(sessionsParent, GITERLOPER_SESSION_BASE_TEST);
  }
  const raw = env.get(GITERLOPER_MCP_TEST_SESSION_PARENT)?.trim();
  if (!raw) {
    return path.join(projectRoot, GITERLOPER_SESSION_BASE_TEST);
  }
  const sessionsParent = resolveValidatedMcpTestSessionParent(raw, projectRoot);
  return path.join(sessionsParent, GITERLOPER_SESSION_BASE_TEST);
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
 * Structural check for MCP startup (specs/mcp.md): non-empty remotes must look like a Git remote
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
