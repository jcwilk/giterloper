/**
 * Local config (gpuMode, etc.) read/write.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureDir } from "./paths.js";
import type { GlState } from "./types.js";

export function readLocalConfig(state: GlState): Record<string, unknown> {
  const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
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

export function ensureGitignoreEntries(state: GlState): void {
  const ignorePath = path.join(state.projectRoot, ".gitignore");
  const required = [".giterloper/versions/", ".giterloper/staged/", ".giterloper/local.json"];
  let current = "";
  if (existsSync(ignorePath)) {
    current = readFileSync(ignorePath, "utf8");
  }
  const lines = current ? current.split(/\r?\n/) : [];
  let changed = false;
  for (const entry of required) {
    if (!lines.some((line) => line.trim() === entry)) {
      lines.push(entry);
      changed = true;
    }
  }
  if (changed) {
    const cleaned = lines
      .filter((_, idx, arr) => !(idx === arr.length - 1 && arr[idx] === ""))
      .join("\n");
    writeFileSync(ignorePath, `${cleaned}\n`, "utf8");
  }
}
