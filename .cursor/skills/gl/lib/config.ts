/**
 * Local config read/write (e.g. local.json for gpuMode).
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureDir } from "./paths.js";
import type { GlState } from "./types.js";

export interface LocalConfig {
  gpuMode?: string;
  [key: string]: unknown;
}

export function readLocalConfig(state: GlState): LocalConfig {
  const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

export function writeLocalConfig(state: GlState, config: LocalConfig): void {
  const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
  ensureDir(path.dirname(p));
  const temp = `${p}.tmp`;
  writeFileSync(temp, JSON.stringify(config, null, 2), "utf8");
  renameSync(temp, p);
}
