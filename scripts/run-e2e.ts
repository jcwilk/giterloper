#!/usr/bin/env -S deno run -A
/**
 * Runs e2e tests in parallel. QMD uses --index per pin+SHA (pinQmd) for isolation.
 * Random pin/branch names (RUN_ID) avoid collisions. pinned.yaml writes are protected by a lock.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_MARKER } from "../tests/e2e/config.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const testDir = path.join(root, "tests", "e2e");
const knowledgePath = path.join(testDir, "gl-knowledge.test.ts");
const writeOpsPath = path.join(testDir, "gl-write-ops.test.ts");
const branchingPath = path.join(testDir, "gl-branching.test.ts");

function cleanupLeakedTestPins() {
  const result = spawnSync("deno", ["run", "-A", path.join(root, "lib", "gl.ts"), "pin", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return;
  let pins: { name?: string }[];
  try {
    pins = JSON.parse(result.stdout);
  } catch {
    return;
  }
  for (const pin of pins) {
    if (pin.name && pin.name.includes(E2E_MARKER)) {
      console.error(`Cleaning up leaked test pin: ${pin.name}`);
      spawnSync("deno", ["run", "-A", path.join(root, "lib", "gl.ts"), "pin", "remove", pin.name!], {
        cwd: root,
        stdio: "inherit",
      });
    }
  }
}

// Ensure CPU-only mode for Cloud VMs (no GPU)
const gpuResult = spawnSync(
  "deno",
  ["run", "-A", path.join(root, "lib", "gl.ts"), "gpu", "--cpu"],
  { cwd: root, stdio: "pipe" }
);
if (gpuResult.status !== 0) {
  console.error("Note: gl gpu --cpu failed, tests may fail on GPU check:", gpuResult.stderr || gpuResult.stdout);
}

const testResult = spawnSync(
  "deno",
  ["test", "-A", "--parallel", knowledgePath, writeOpsPath, branchingPath],
  { cwd: root, stdio: "inherit" }
);

cleanupLeakedTestPins();
Deno.exit(testResult.status ?? 1);
