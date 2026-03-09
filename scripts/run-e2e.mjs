#!/usr/bin/env node
/**
 * Runs e2e tests in parallel. QMD uses --index per pin+SHA (pinQmd) for isolation.
 * Random pin/branch names (RUN_ID) avoid collisions. pinned.yaml writes are protected by a lock.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_MARKER } from "../tests/e2e/config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const testDir = path.join(root, "tests", "e2e");
const knowledgePath = path.join(testDir, "gl-knowledge.test.mjs");
const writeOpsPath = path.join(testDir, "gl-write-ops.test.mjs");

function cleanupLeakedTestPins() {
  const glScript = path.join(root, ".cursor", "skills", "gl", "scripts", "gl.mjs");
  const listResult = spawnSync("node", [glScript, "pin", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (listResult.status !== 0) return;
  let pins;
  try {
    pins = JSON.parse(listResult.stdout);
  } catch {
    return;
  }
  for (const pin of pins) {
    if (pin.name && pin.name.includes(E2E_MARKER)) {
      console.error(`Cleaning up leaked test pin: ${pin.name}`);
      spawnSync("node", [glScript, "pin", "remove", pin.name], {
        cwd: root,
        stdio: "inherit",
      });
    }
  }
}

function cleanupOrphanedTestQmdFiles() {
  const dirs = [
    path.join(root, ".giterloper", "qmd", "config", "qmd"),
    path.join(root, ".giterloper", "qmd", "cache", "qmd"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.includes(E2E_MARKER)) {
        try {
          fs.unlinkSync(path.join(dir, f));
          console.error(`Cleaned orphaned qmd file: ${path.join(dir, f)}`);
        } catch {}
      }
    }
  }
}

const result = spawnSync(
  "node",
  ["--test", "--test-concurrency=2", knowledgePath, writeOpsPath],
  { cwd: root, stdio: "inherit" }
);

cleanupLeakedTestPins();
cleanupOrphanedTestQmdFiles();
process.exit(result.status ?? 1);
