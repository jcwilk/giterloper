#!/usr/bin/env -S deno run -A
/**
 * Runs e2e tests. Random pin/branch names (RUN_ID) avoid collisions.
 * CLI E2E tests use a unique `--session-id` per test file (see tests/helpers/gl.ts); parallel files do not contend on `_cli`.
 * cleanupLeakedTestPins() removes leaked E2E pins from every session directory under `.giterloper/sessions/`.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_MARKER } from "../tests/e2e/config.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(root, "tests", "e2e");

const SESSION_ID_SAFE = /^[a-zA-Z0-9_-]+$/;

function cleanupLeakedTestPinsInSession(glScript: string, sessionId: string) {
  const listResult = spawnSync(glScript, ["--json", "--session-id", sessionId, "pin", "list"], {
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
      console.error(`Cleaning up leaked test pin (${sessionId}): ${pin.name}`);
      spawnSync(glScript, ["--json", "--session-id", sessionId, "pin", "remove", pin.name!], {
        cwd: root,
        stdio: "inherit",
      });
    }
  }
}

function cleanupLeakedTestPins() {
  const glScript = path.join(root, ".cursor", "skills", "gl", "scripts", "gl");
  const sessionsRoot = path.join(root, ".giterloper", "sessions");
  if (!existsSync(sessionsRoot)) return;
  for (const name of readdirSync(sessionsRoot)) {
    if (!SESSION_ID_SAFE.test(name)) continue;
    let sub: string;
    try {
      sub = path.join(sessionsRoot, name);
      if (!statSync(sub).isDirectory()) continue;
    } catch {
      continue;
    }
    cleanupLeakedTestPinsInSession(glScript, name);
  }
}

const result = spawnSync(
  "deno",
  ["test", "-A", testDir],
  { cwd: root, stdio: "inherit" }
);

cleanupLeakedTestPins();
Deno.exit(result.status ?? 1);
