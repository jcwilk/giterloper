#!/usr/bin/env node
/**
 * Thin wrapper that runs lib/gl.ts via Node's native TypeScript support.
 * Keeps the same entry point for npm scripts, E2E tests, and SKILL.md.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..", "..", "..", "..");
const glScript = path.join(workspaceRoot, "lib", "gl.ts");

const result = spawnSync(process.execPath, ["--experimental-strip-types", glScript, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: workspaceRoot,
});
process.exit(result.status ?? 1);
