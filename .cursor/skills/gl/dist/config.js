/**
 * Local config read/write (e.g. local.json for gpuMode).
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureDir } from "./paths.js";
export function readLocalConfig(state) {
    const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
    if (!existsSync(p))
        return {};
    try {
        return JSON.parse(readFileSync(p, "utf8"));
    }
    catch {
        return {};
    }
}
export function writeLocalConfig(state, config) {
    const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
    ensureDir(path.dirname(p));
    const temp = `${p}.tmp`;
    writeFileSync(temp, JSON.stringify(config, null, 2), "utf8");
    renameSync(temp, p);
}
