#!/usr/bin/env -S deno run -A
/**
 * Runs e2e tests. QMD uses --index per pin+SHA (pinQmd) for isolation.
 * Random pin/branch names (RUN_ID) avoid collisions. pinned.yaml writes are protected by a lock.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_MARKER } from "../tests/e2e/config.ts";

const root = join(path.dirname(fileURLToPath(import.meta.url)), "..");
const glScript = join(root, "lib", "gl.ts");
const knowledgePath = join(root, "tests", "e2e", "gl-knowledge.test.ts");
const writeOpsPath = join(root, "tests", "e2e", "gl-write-ops.test.ts");
const branchingPath = join(root, "tests", "e2e", "gl-branching.test.ts");

function cleanupLeakedTestPins(): void {
  const deno = Deno.env.get("DENO") || "deno";
  const listResult = spawnSync(deno, ["run", "-A", glScript, "pin", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (listResult.status !== 0) return;
  let pins: { name?: string }[];
  try {
    pins = JSON.parse(listResult.stdout || "[]");
  } catch {
    return;
  }
  for (const pin of pins) {
    if (pin.name && pin.name.includes(E2E_MARKER)) {
      console.error(`Cleaning up leaked test pin: ${pin.name}`);
      spawnSync(deno, ["run", "-A", glScript, "pin", "remove", pin.name], {
        cwd: root,
        stdio: "inherit",
      });
    }
  }
}

const deno = Deno.env.get("DENO") || "deno";
const result = spawnSync(
  deno,
  ["test", "-A", "--parallel", knowledgePath, writeOpsPath, branchingPath],
  { cwd: root, stdio: "inherit" }
);

cleanupLeakedTestPins();
Deno.exit(result.status ?? 1);
