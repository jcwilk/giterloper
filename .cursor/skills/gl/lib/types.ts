/**
 * Shared types for the giterloper CLI.
 */

/** A pin entry from pinned.yaml. */
export interface Pin {
  name: string;
  source: string;
  sha: string;
  branch?: string;
}

/** Runtime state passed to commands. */
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

/** Result of a soft run (does not throw on non-zero exit). */
export interface RunResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
  error?: Error;
}

/** Type guard: returns true if value has Pin shape. Used for runtime checks. */
export function isPin(value: unknown): value is Pin {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "source" in value &&
    "sha" in value &&
    typeof (value as Pin).name === "string" &&
    typeof (value as Pin).source === "string" &&
    typeof (value as Pin).sha === "string"
  );
}
