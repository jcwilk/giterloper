/**
 * Shared types for the giterloper CLI.
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
  gpuMode?: "cuda" | "cpu" | null;
}

export interface RunResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
  error?: Error;
}
