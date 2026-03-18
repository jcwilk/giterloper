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
import type { GlState } from "./types.ts";
import type { Pin } from "./types.ts";

export type { GlState };

const PROJECT_ROOT = path.resolve(Deno.cwd());

/** Env var for session auto-init: repo source (e.g. github.com/owner/repo). When set, new sessions start with _session pin at main. */
export const KNOWLEDGE_STORE_REMOTE = "KNOWLEDGE_STORE_REMOTE";

/**
 * Ensures session root exists. Called by MCP stateForSession.
 */
export function ensureSessionDir(state: GlState): void {
  if (!existsSync(state.rootDir)) {
    mkdirSync(state.rootDir, { recursive: true });
  }
}

/**
 * Lazily creates _session pin when KNOWLEDGE_STORE_REMOTE is set and no _session pin exists.
 * Session pin starts at main branch with remote main's SHA. No shared pinned.yaml.
 */
export function autoInitSessionPin(state: GlState): void {
  const pins = readPins(state);
  if (pins.some((p) => p.name === SESSION_PIN_NAME)) return;

  const source = Deno.env.get(KNOWLEDGE_STORE_REMOTE)?.trim();
  if (!source) return;

  const sha = resolveSha(source, "HEAD");
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
 * Creates GlState. Mutable paths root under .giterloper/sessions/<sessionId>/
 * (pinned.yaml, versions, staged, indexes).
 */
export function makeState(sessionId: string): GlState {
  const projectRoot = PROJECT_ROOT;
  const baseGiterloper = path.join(projectRoot, ".giterloper");
  const validated = validateSessionId(sessionId);
  const sessionRoot = path.join(baseGiterloper, "sessions", validated);
  return {
    projectRoot,
    rootDir: sessionRoot,
    versionsDir: path.join(sessionRoot, "versions"),
    stagedRoot: path.join(sessionRoot, "staged"),
    pinnedPath: path.join(sessionRoot, "pinned.yaml"),
    globalJson: false,
    sessionId: validated,
  };
}
