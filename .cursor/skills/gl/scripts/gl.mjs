#!/usr/bin/env node

/**
 * Thin entry point: parse args, build state, dispatch to commands, handle GlError.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { findProjectRoot } from "../dist/paths.js";
import { EXIT, GlError, fail } from "../dist/errors.js";
import { consumeBooleanFlag } from "../dist/cli.js";
import { readLocalConfig } from "../dist/config.js";
import { printTopHelp, runCommand } from "../dist/commands/index.js";

try {
  let args = process.argv.slice(2);
  const helpJsonParsed = consumeBooleanFlag(args, "--json");
  args = helpJsonParsed.args;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printTopHelp();
    process.exit(EXIT.OK);
  }
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    fail("no .git directory found in current path or parents", EXIT.STATE);
  }
  const state = {
    projectRoot,
    rootDir: path.join(projectRoot, ".giterloper"),
    versionsDir: path.join(projectRoot, ".giterloper", "versions"),
    stagedRoot: path.join(projectRoot, ".giterloper", "staged"),
    pinnedPath: path.join(projectRoot, ".giterloper", "pinned.yaml"),
    localConfigPath: path.join(projectRoot, ".giterloper", "local.json"),
    globalJson: false,
  };
  process.env.XDG_CONFIG_HOME = path.join(state.rootDir, "qmd", "config");
  process.env.XDG_CACHE_HOME = path.join(state.rootDir, "qmd", "cache");
  state.globalJson = helpJsonParsed.found;
  const localConfig = readLocalConfig(state);
  state.gpuMode = localConfig.gpuMode || null;
  if (state.gpuMode === "cpu") {
    process.env.NODE_LLAMA_CPP_GPU = "false";
  }
  const [cmd, ...rest] = args;
  runCommand(state, cmd, rest);
} catch (e) {
  if (e instanceof GlError) {
    console.error(`gl: ${e.message}`);
    process.exit(e.code);
  }
  console.error(`gl: unexpected error: ${e?.message ?? e}`);
  process.exit(EXIT.EXTERNAL);
}

export const __filename = fileURLToPath(import.meta.url);
