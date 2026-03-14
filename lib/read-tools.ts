/**
 * Shared logic for MCP read tools (search, retrieve).
 * Version-pinned resolution, path safety, and retrieval helpers.
 */
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

import type { GlState, Pin } from "./types.ts";
import { cloneDir } from "./paths.ts";
import { verifyCloneAtSha } from "./pin-lifecycle.ts";

/**
 * Retrieve file content from a pin's clone at the given SHA.
 * Validates clone existence, SHA match, path containment (no traversal).
 * @throws Error if clone missing, SHA mismatch, path escapes, or file not found.
 */
export function retrieveFileContent(
  state: GlState,
  pin: Pin,
  effectiveSha: string,
  filePath: string
): string {
  const pinAtSha: Pin = { ...pin, sha: effectiveSha };
  const clonePath = cloneDir(state, pinAtSha);

  if (!existsSync(clonePath)) {
    throw new Error(
      `No clone for pin "${pin.name}" at ${effectiveSha}. Run "gl pin load" or ensure the version is cloned.`
    );
  }
  if (!verifyCloneAtSha(pinAtSha, clonePath)) {
    throw new Error(
      `Clone for pin "${pin.name}" at ${clonePath} is not at expected SHA ${effectiveSha}.`
    );
  }

  const fullPath = path.resolve(clonePath, filePath);
  const cloneResolved = path.resolve(clonePath);
  const relative = path.relative(cloneResolved, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes clone directory");
  }
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return readFileSync(fullPath, "utf8");
}
