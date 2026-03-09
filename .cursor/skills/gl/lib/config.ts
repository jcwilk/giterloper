/**
 * Local config (giterloper/local.json) read/write.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureDir } from "./paths.js";
import type { GlState } from "./types.js";

export function readLocalConfig(state: GlState): Record<string, unknown> {
  const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function writeLocalConfig(state: GlState, config: Record<string, unknown>): void {
  const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
  ensureDir(path.dirname(p));
  const temp = `${p}.tmp`;
  writeFileSync(temp, JSON.stringify(config, null, 2), "utf8");
  renameSync(temp, p);
}
