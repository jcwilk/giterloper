/**
 * Core shared state for gl CLI. Used by gl.ts and gl-maintenance.ts.
 */
import path from "node:path";

import type { GlState } from "./types.ts";

export type { GlState };

const PROJECT_ROOT = path.resolve(Deno.cwd());

export function makeState(): GlState {
  const projectRoot = PROJECT_ROOT;
  const state: GlState = {
    projectRoot,
    rootDir: path.join(projectRoot, ".giterloper"),
    versionsDir: path.join(projectRoot, ".giterloper", "versions"),
    stagedRoot: path.join(projectRoot, ".giterloper", "staged"),
    pinnedPath: path.join(projectRoot, ".giterloper", "pinned.yaml"),
    globalJson: false,
  };
  return state;
}
