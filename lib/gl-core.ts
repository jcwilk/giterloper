/**
 * Core shared state for gl CLI. Used by gl.ts and gl-maintenance.ts.
 * MCP server uses makeState(sessionId) for session-scoped mutable paths.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EXIT, fail } from "./errors.ts";
import { parsePinned } from "./pinned.ts";
import { run } from "./run.ts";
import type { GlState } from "./types.ts";

export type { GlState };

const PROJECT_ROOT = path.resolve(Deno.cwd());

/** Shared .giterloper root (non-session). */
const SHARED_ROOT = path.join(PROJECT_ROOT, ".giterloper");
const SHARED_PINNED = path.join(SHARED_ROOT, "pinned.yaml");
const SHARED_VERSIONS = path.join(SHARED_ROOT, "versions");

/**
 * Bootstraps session-local state from shared .giterloper when session dir is empty.
 * Ensures session root exists, copies shared pinned.yaml if missing, and copies existing
 * version clones so MCP tools can resolve pins. Called by MCP stateForSession.
 */
export function bootstrapSessionFromShared(state: GlState): void {
  if (!state.sessionId) return;
  if (!existsSync(state.rootDir)) {
    mkdirSync(state.rootDir, { recursive: true });
  }
  if (!existsSync(state.pinnedPath) && existsSync(SHARED_PINNED)) {
    const content = readFileSync(SHARED_PINNED, "utf8");
    writeFileSync(state.pinnedPath, content, "utf8");
    // Bootstrap version clones so retrieve/search work without cloning
    const pins = parsePinned(content);
    for (const pin of pins) {
      const sharedClone = path.join(SHARED_VERSIONS, pin.name, pin.sha);
      const sessionClone = path.join(state.versionsDir, pin.name, pin.sha);
      if (existsSync(sharedClone) && !existsSync(sessionClone)) {
        mkdirSync(path.dirname(sessionClone), { recursive: true });
        run("cp", ["-r", sharedClone, sessionClone]);
      }
    }
  }
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
 * Creates GlState. When sessionId is provided, mutable paths root under
 * .giterloper/sessions/<sessionId>/ (pinned.yaml, versions, staged, indexes).
 * CLI and maintenance use makeState() without sessionId (shared .giterloper/).
 */
export function makeState(sessionId?: string | null): GlState {
  const projectRoot = PROJECT_ROOT;
  const baseGiterloper = path.join(projectRoot, ".giterloper");

  if (sessionId != null && sessionId !== "") {
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

  return {
    projectRoot,
    rootDir: baseGiterloper,
    versionsDir: path.join(baseGiterloper, "versions"),
    stagedRoot: path.join(baseGiterloper, "staged"),
    pinnedPath: path.join(baseGiterloper, "pinned.yaml"),
    globalJson: false,
  };
}
