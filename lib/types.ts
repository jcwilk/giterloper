/**
 * Shared type definitions for giterloper. See CONVENTIONS.md for coding conventions.
 */

export type RetryLogRole = "cli" | "mcp" | "test";

/** Optional correlation for append-only logs/giterloper-retry.log (see AGENTS.md). */
export interface RetryLogContext {
  sessionId?: string;
  role?: RetryLogRole;
}

export interface Pin {
  name: string;
  source: string;
  sha: string;
  branch?: string;
}

export interface GlState {
  projectRoot: string;
  rootDir: string;
  versionsDir: string;
  stagedRoot: string;
  pinnedPath: string;
  globalJson: boolean;
  /** Mutable paths (pinned.yaml, versions, staged, indexes) root under session base + sessionId (shared core under `specs/`). */
  sessionId: string;
  /** `.giterloper` vs `.giterloper_test` per MCP mode (MCP slice under `specs/`). */
  mcpTestMode: boolean;
  /** Set by makeState callers so retry logs distinguish cli vs mcp. */
  retryLogRole?: RetryLogRole;
}

export interface RunResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
  error: Error | undefined;
}

/** Sentinel export to verify the types module loads. */
export const __typesVersion = 1;
