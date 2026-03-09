#!/usr/bin/env node
/**
 * Benchmark gl index with focus on embed skip optimization.
 *
 * Usage:
 *   node scripts/bench-gl-index.mjs
 *
 * Requires: run `node scripts/bench-embed.mjs --teardown-first` first to create
 * the benchmark index. Then run this script - it times `gl index` equivalent
 * using the knowledge pin. For "already embedded" case, run when the pin's
 * collection is fully indexed.
 *
 * This script uses a temporary pin that points to the bench data.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GL = path.join(ROOT, ".cursor/skills/gl/scripts/gl.mjs");

function main() {
  console.log("Running: node", GL, "index");
  const start = performance.now();
  const result = spawnSync("node", [GL, "index"], {
    encoding: "utf8",
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
  });
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`\nElapsed: ${elapsed}s`);
  process.exit(result.status === 0 ? 0 : 1);
}

main();
