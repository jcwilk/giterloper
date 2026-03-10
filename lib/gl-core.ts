/**
 * Core shared state for gl CLI. Used by gl.ts and gl-maintenance.ts.
 */
import path from "node:path";

import { EXIT, fail } from "./errors.ts";
import { findProjectRoot } from "./paths.ts";
import { readLocalConfig } from "./config.ts";
import type { GlState } from "./types.ts";

export type { GlState };

export function makeState(): GlState {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    fail("no .git directory found in current path or parents", EXIT.STATE);
  }
  const state: GlState = {
    projectRoot,
    rootDir: path.join(projectRoot, ".giterloper"),
    versionsDir: path.join(projectRoot, ".giterloper", "versions"),
    stagedRoot: path.join(projectRoot, ".giterloper", "staged"),
    pinnedPath: path.join(projectRoot, ".giterloper", "pinned.yaml"),
    localConfigPath: path.join(projectRoot, ".giterloper", "local.json"),
    globalJson: false,
    gpuMode: null,
  };
  Deno.env.set("XDG_CONFIG_HOME", path.join(state.rootDir, "qmd", "config"));
  Deno.env.set("XDG_CACHE_HOME", path.join(state.rootDir, "qmd", "cache"));
  const localConfig = readLocalConfig(state);
  state.gpuMode = (localConfig.gpuMode as string) || null;
  if (state.gpuMode === "cpu") {
    Deno.env.set("NODE_LLAMA_CPP_GPU", "false");
  }
  return state;
}
