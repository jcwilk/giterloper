#!/usr/bin/env -S deno run -A
/**
 * Runs e2e tests. QMD uses --index per pin+SHA (pinQmd) for isolation.
 * Random pin/branch names (RUN_ID) avoid collisions. pinned.yaml writes are protected by a lock.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_MARKER } from "../tests/e2e/config.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(root, "tests", "e2e");

function cleanupLeakedTestPins() {
  const glScript = path.join(root, ".cursor", "skills", "gl", "scripts", "gl");
  const listResult = spawnSync(glScript, ["pin", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (listResult.status !== 0) return;
  let pins: { name?: string }[];
  try {
    pins = JSON.parse(listResult.stdout);
  } catch {
    return;
  }
  for (const pin of pins) {
    if (pin.name && pin.name.includes(E2E_MARKER)) {
      console.error(`Cleaning up leaked test pin: ${pin.name}`);
      spawnSync(glScript, ["pin", "remove", pin.name!], {
        cwd: root,
        stdio: "inherit",
      });
    }
  }
}

const result = spawnSync(
  "deno",
  ["test", "-A", "--parallel", testDir],
  { cwd: root, stdio: "inherit" }
);

cleanupLeakedTestPins();
const glExtended = path.join(root, "scripts", "gl-extended");
spawnSync(glExtended, ["qmd-orphan-cleanup"], { cwd: root, stdio: "pipe" });
Deno.exit(result.status ?? 1);
