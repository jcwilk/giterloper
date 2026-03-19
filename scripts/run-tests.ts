#!/usr/bin/env -S deno run -A
/**
 * Runs all topic test suites (tests/core, tests/cli, tests/mcp).
 * - `tests/core/`: `deno test --parallel` (worker count from `DENO_JOBS` or CPU count; see `deno test --help`).
 * - `tests/cli/` and `tests/mcp/`: **without** `--parallel`. Deno runs parallel test modules in the same OS process
 *   with a shared `Deno.env`; MCP tests toggle `MCP_INSECURE`, `MCP_TOKEN`, and `KNOWLEDGE_STORE_REMOTE`, and CLI+MCP
 *   integration tests share `.giterloper/` under the repo root — running those files concurrently causes flakes
 *   (401 auth, missing pins, git cwd errors). Core unit tests do not hit that.
 * CLI tests use a unique `--session-id` per file (see tests/helpers/gl.ts).
 * cleanupLeakedTestPins() removes leaked integration-test pins (names containing E2E_MARKER / `gle2e_`) from every session under `.giterloper/sessions/`.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_MARKER } from "../tests/helpers/config.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreDir = path.join(root, "tests/core");
const integrationDirs = ["tests/cli", "tests/mcp"].map((d) => path.join(root, d));

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

function runDenoTest(args: string[]): number {
  const result = spawnSync("deno", ["test", "-A", ...args], {
    cwd: root,
    stdio: "inherit",
  });
  return result.status ?? 1;
}

const coreStatus = runDenoTest(["--parallel", coreDir]);
if (coreStatus !== 0) {
  cleanupLeakedTestPins();
  Deno.exit(coreStatus);
}

const intStatus = runDenoTest(integrationDirs);
cleanupLeakedTestPins();
Deno.exit(intStatus);
