/**
 * Path utilities: ensureDir, cloneDir, stagedDir.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import type { GlState, Pin } from "./types.ts";

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function cloneDir(state: GlState, pin: Pin): string {
  return path.join(state.versionsDir, pin.name, pin.sha);
}

export function stagedDir(state: GlState, pinName: string, branchName: string): string {
  return path.join(state.stagedRoot, pinName, branchName);
}

export function indexDir(state: GlState, pinName: string, sha: string): string {
  return path.join(state.rootDir, "indexes", pinName, sha);
}
