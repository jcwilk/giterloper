/**
 * MCP session store and cleanup. Manages session-local state under the session base dir
 * (`.giterloper` or `.giterloper_test` per specs/mcp.md) + `<sessionId>/`.
 * Provides explicit cleanup via giterloper_session_end and DELETE /mcp, plus stale-session
 * scavenging by last-activity TTL. Decoupled from tool handlers.
 *
 * See ticket git-zdbt.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  effectiveGiterloperSessionsRoot,
  effectiveMcpTestSessionParentOverride,
  type McpSessionLayoutOpts,
  resolveMcpTestMode,
  resolveProductRoot,
} from "./session-layout.ts";

export type { McpSessionLayoutOpts };

function resolveLayoutProjectRoot(layout?: McpSessionLayoutOpts): string {
  const o = layout?.projectRoot?.trim();
  return o && o.length > 0 ? path.resolve(o) : resolveProductRoot();
}

/** Direct children are session id directories only (see docs/DEPLOYMENT_REQUIREMENTS.md). */
function giterloperRootPath(
  mcpTestMode?: boolean,
  layout?: McpSessionLayoutOpts
): string {
  const mode = resolveMcpTestMode(mcpTestMode);
  const pr = resolveLayoutProjectRoot(layout);
  return effectiveGiterloperSessionsRoot(
    pr,
    mode,
    Deno.env,
    effectiveMcpTestSessionParentOverride(mode, layout)
  );
}

const LAST_ACTIVITY_FILENAME = ".last_activity";
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Returns the directory path for a session. Does not validate sessionId.
 * @param mcpTestMode When omitted, **normal** session layout (see `resolveMcpTestMode` in `session-layout.ts`).
 */
export function sessionDir(
  sessionId: string,
  mcpTestMode?: boolean,
  layout?: McpSessionLayoutOpts
): string {
  return path.join(giterloperRootPath(mcpTestMode, layout), sessionId);
}

/**
 * Validates sessionId for use in paths. Returns false if invalid (does not throw).
 * Use for cleanup paths that may receive unchecked input (e.g. headers).
 */
export function isSafeSessionId(sessionId: string | null | undefined): sessionId is string {
  if (!sessionId || typeof sessionId !== "string") return false;
  const trimmed = sessionId.trim();
  return trimmed.length > 0 && SESSION_ID_REGEX.test(trimmed);
}

/**
 * Removes session-local state under the active session base best-effort.
 * Validates sessionId for path safety; skips removal if invalid.
 * Does not throw.
 */
export function removeSessionData(
  sessionId: string | null | undefined,
  mcpTestMode?: boolean,
  layout?: McpSessionLayoutOpts
): void {
  if (!isSafeSessionId(sessionId)) return;
  const dir = sessionDir(sessionId, mcpTestMode, layout);
  if (!existsSync(dir)) return;
  try {
    rmSync(dir, { recursive: true });
  } catch {
    // Best-effort; ignore failures
  }
}

/**
 * Records last activity for a session. Writes a timestamp file used by scavenge.
 * Call after validating sessionId (e.g. in stateForSession).
 */
export function touchSession(
  sessionId: string,
  mcpTestMode?: boolean,
  layout?: McpSessionLayoutOpts
): void {
  const dir = sessionDir(sessionId, mcpTestMode, layout);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stamp = Date.now().toString();
  try {
    writeFileSync(path.join(dir, LAST_ACTIVITY_FILENAME), stamp, "utf8");
  } catch {
    // Best-effort
  }
}

/**
 * Removes sessions whose last activity is older than ttlMs.
 * Returns the number of sessions removed.
 */
export function scavengeStaleSessions(
  ttlMs: number,
  mcpTestMode?: boolean,
  layout?: McpSessionLayoutOpts
): number {
  if (ttlMs <= 0) return 0;
  const gRoot = giterloperRootPath(mcpTestMode, layout);
  if (!existsSync(gRoot)) return 0;
  const now = Date.now();
  const cutoff = now - ttlMs;
  let removed = 0;
  try {
    const entries = readdirSync(gRoot);
    for (const name of entries) {
      if (!isSafeSessionId(name)) continue;
      const dir = path.join(gRoot, name);
      const stampPath = path.join(dir, LAST_ACTIVITY_FILENAME);
      let lastActivity = 0;
      if (existsSync(stampPath)) {
        try {
          const content = readFileSync(stampPath, "utf8");
          const parsed = parseInt(content, 10);
          if (!Number.isNaN(parsed)) {
            lastActivity = parsed;
          } else {
            // Empty/corrupt stamp must not be treated as epoch 0 (would delete active sessions).
            try {
              lastActivity = statSync(dir).mtimeMs;
            } catch {
              continue;
            }
          }
        } catch {
          // Use mtime as fallback
          try {
            lastActivity = statSync(dir).mtimeMs;
          } catch {
            continue;
          }
        }
      } else {
        // No stamp; use dir mtime
        try {
          lastActivity = statSync(dir).mtimeMs;
        } catch {
          continue;
        }
      }
      if (lastActivity < cutoff) {
        try {
          rmSync(dir, { recursive: true });
          removed++;
        } catch {
          // Best-effort
        }
      }
    }
  } catch {
    // Best-effort
  }
  return removed;
}

/** Default TTL for stale session scavenging: 24 hours. */
export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Returns configured TTL in ms from MCP_SESSION_TTL_MS.
 * Returns 0 if not set or invalid (disables scavenging).
 */
export function getSessionTtlMs(): number {
  const s = Deno.env.get("MCP_SESSION_TTL_MS");
  if (!s) return DEFAULT_SESSION_TTL_MS;
  const n = parseInt(s, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}
