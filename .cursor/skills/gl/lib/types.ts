/**
 * Shared type definitions for the gl CLI.
 */

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
  localConfigPath?: string;
  globalJson: boolean;
  gpuMode: string | null;
}

export interface RunResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
  error: Error | undefined;
}

/** Runtime placeholder so ESM import { Pin } works from gl.mjs (interfaces are erased). */
export const Pin = null;
