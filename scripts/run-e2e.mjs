#!/usr/bin/env node
/**
 * Runs e2e tests in parallel. QMD uses --index per pin+SHA (pinQmd) for isolation.
 * --test-concurrency=2 limits qmd embed load. Increase if embed "Failed to create context" occurs.
 * Random pin/branch names (RUN_ID) avoid collisions. pinned.yaml writes are protected by a lock.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const testDir = path.join(root, "tests", "e2e");
const knowledgePath = path.join(testDir, "gl-knowledge.test.mjs");
const writeOpsPath = path.join(testDir, "gl-write-ops.test.mjs");

const result = spawnSync(
  "node",
  ["--test", "--test-concurrency=2", knowledgePath, writeOpsPath],
  { cwd: root, stdio: "inherit" }
);

process.exit(result.status ?? 1);
