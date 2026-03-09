/**
 * Path helpers: project root, directories, clone/stage paths.
 * Uses fs only for existence checks and mkdir.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { GlState, Pin } from "./types.js";

export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

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
