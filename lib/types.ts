/**
 * Shared type definitions for giterloper. See CONVENTIONS.md for coding conventions.
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

/** Sentinel export to verify the types module loads. */
export const __typesVersion = 1;
