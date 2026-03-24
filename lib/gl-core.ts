/**
 * Core shared state for gl CLI. Used by gl.ts and gl-maintenance.ts.
 * MCP server uses makeState(sessionId) for session-scoped mutable paths.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { EXIT, fail } from "./errors.ts";
import { mutatePins, readPins, SESSION_PIN_NAME } from "./pinned.ts";
import { clonePin } from "./pin-lifecycle.ts";
import { resolveSha } from "./git.ts";
import {
  effectiveGiterloperSessionsRoot,
  effectiveKnowledgeStoreRemote,
  KNOWLEDGE_STORE_REMOTE_ENV,
  resolveMcpTestMode,
  resolveProductRoot,
} from "./session-layout.ts";
import type { GlState, Pin, RetryLogRole } from "./types.ts";

export type { GlState };

/** Env var name for normal-mode session auto-init remote (value read via {@link effectiveKnowledgeStoreRemote}). */
export const KNOWLEDGE_STORE_REMOTE = KNOWLEDGE_STORE_REMOTE_ENV;

/**
 * Ensures session root exists. Called by MCP stateForSession.
 */
export function ensureSessionDir(state: GlState): void {
  if (!existsSync(state.rootDir)) {
    mkdirSync(state.rootDir, { recursive: true });
  }
}

/**
 * Lazily creates _session pin when a bootstrap remote is configured and no _session pin exists.
 * Session pin starts at main branch with remote main's SHA.
 *
 * @param knowledgeStoreRemoteOverride `undefined` → env for active MCP test mode (`KNOWLEDGE_STORE_REMOTE` vs `TEST_KNOWLEDGE_STORE_REMOTE`); `null` → do not bootstrap; string → use as source (trimmed; empty skips)
 */
export function autoInitSessionPin(
  state: GlState,
  knowledgeStoreRemoteOverride?: string | null
): void {
  const pins = readPins(state);
  if (pins.some((p) => p.name === SESSION_PIN_NAME)) return;

  const source = effectiveKnowledgeStoreRemote(
    state.mcpTestMode,
    knowledgeStoreRemoteOverride
  );
  if (!source) return;

  const sha = resolveSha(source, "HEAD", {
    sessionId: state.sessionId,
    role: state.retryLogRole ?? "mcp",
  });
  const sessionPin: Pin = {
    name: SESSION_PIN_NAME,
    source,
    sha,
    branch: "main",
  };
  clonePin(state, sessionPin);
  mutatePins(state, (list) => [sessionPin, ...list]);
}

/** Safe filename chars; prevents path escape. Used for sessionId validation. */
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validates sessionId for use in filesystem paths. Rejects empty, "..", path separators.
 * Throws if invalid.
 */
export function validateSessionId(sessionId: string | null | undefined): string {
  if (!sessionId || typeof sessionId !== "string") {
    fail("sessionId is required for MCP state", EXIT.STATE);
  }
  const trimmed = sessionId.trim();
  if (!trimmed) fail("sessionId cannot be empty", EXIT.STATE);
  if (!SESSION_ID_REGEX.test(trimmed)) {
    fail(
      `sessionId contains invalid characters (allowed: a-z, A-Z, 0-9, _, -); max 128 chars`,
      EXIT.STATE
    );
  }
  return trimmed;
}

/**
 * Creates GlState. Mutable paths root under `<projectRoot>/<sessionBase>/<sessionId>/`
 * (pinned.yaml, versions, staged, indexes). Session base follows MCP test mode (specs/core.md, specs/MCP.md).
 */
export function makeState(
  sessionId: string,
  opts?: { retryLogRole?: RetryLogRole; mcpTestMode?: boolean }
): GlState {
  const projectRootResolved = resolveProductRoot();
  const mcpTestMode = resolveMcpTestMode(opts?.mcpTestMode);
  const sessionsRoot = effectiveGiterloperSessionsRoot(
    projectRootResolved,
    mcpTestMode
  );
  const validated = validateSessionId(sessionId);
  const sessionRoot = path.join(sessionsRoot, validated);
  return {
    projectRoot: projectRootResolved,
    rootDir: sessionRoot,
    versionsDir: path.join(sessionRoot, "versions"),
    stagedRoot: path.join(sessionRoot, "staged"),
    pinnedPath: path.join(sessionRoot, "pinned.yaml"),
    globalJson: false,
    sessionId: validated,
    mcpTestMode,
    retryLogRole: opts?.retryLogRole,
  };
}
