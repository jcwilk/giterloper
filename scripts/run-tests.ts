#!/usr/bin/env -S deno run -A
/**
 * Runs all topic test suites (tests/core, tests/cli, tests/mcp).
 *
 * **Target behavior** (canonical): one bounded worker pool over **logical test cases**, per-case isolation (temp cwd,
 * `.giterloper/<sessionId>/`), no suite-wide cleanup on the happy path, MCP/config injection in tests instead of
 * mutating `Deno.env`. See `tests/README.md` and `docs/TEST_PARALLELISM_PLAN.md`.
 *
 * **Current implementation** (until that migration lands): `tests/core/` with `deno test --parallel`, then `tests/cli/`
 * and `tests/mcp/` in one serial `deno test` invocation; `cleanupLeakedTestPins()` sweeps `.giterloper/*` session dirs.
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
  const giterloperRoot = path.join(root, ".giterloper");
  if (!existsSync(giterloperRoot)) return;
  for (const name of readdirSync(giterloperRoot)) {
    if (!SESSION_ID_SAFE.test(name)) continue;
    let sub: string;
    try {
      sub = path.join(giterloperRoot, name);
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
