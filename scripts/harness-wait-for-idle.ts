#!/usr/bin/env -S deno run -A
/**
 * CLI: block until harness metadata shows no live orchestrator (see tests/README.md).
 * Polls the same classification as `acquireHarnessOrchestratorLock` / `harness-status.ts`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeHarnessOrchestratorWaitContext,
  HARNESS_ORCHESTRATOR_WAIT_INITIAL_BACKOFF_MS,
  HARNESS_ORCHESTRATOR_WAIT_MAX_BACKOFF_MS,
  HARNESS_ORCHESTRATOR_WAIT_THROTTLE_MS,
} from "./harness-orchestrator-lock.ts";

const SCRIPT_HELP = `Usage: deno run -A scripts/harness-wait-for-idle.ts [--project-root <dir>]

Poll harness orchestrator metadata until there is no *live* holder (same rules as
deno task test wait messaging: see tests/README.md). Prints occasional lines to stdout
while waiting. Exits 0 when idle.

This tool does not acquire the flock, send signals, or kill any process. There is no
timeout that kills the harness or this waiter—interrupt with Ctrl+C if you need to stop.

For CI or hosts that cannot invoke scripts/run-tests.ts but must pause until the suite
is not reporting a live orchestrator PID in metadata, use this script or deno task harness:wait-for-idle.

Stable task: deno task harness:wait-for-idle
`;

function parseArgs(
  args: string[],
  defaultRoot: string,
): { root: string } | { help: true } | { error: string } {
  let root = defaultRoot;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--help" || a === "-h") return { help: true };
    if (a === "--project-root") {
      const v = args[++i];
      if (!v) return { error: "--project-root requires a directory" };
      root = path.resolve(v);
      continue;
    }
    return { error: `unknown argument: ${a}` };
  }
  return { root };
}

const defaultRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const parsed = parseArgs(Deno.args, defaultRoot);

if ("error" in parsed) {
  console.error(parsed.error);
  Deno.exit(64);
}
if ("help" in parsed) {
  console.log(SCRIPT_HELP);
  Deno.exit(0);
}

const { root } = parsed;
let backoff = HARNESS_ORCHESTRATOR_WAIT_INITIAL_BACKOFF_MS;
let lastPrintedPid: number | undefined;
let lastThrottlePrintAt = 0;
let printedFirstWait = false;

while (true) {
  const { record, stale } = await describeHarnessOrchestratorWaitContext(root);
  const pid = record !== null && !stale ? record.pid : undefined;

  if (pid === undefined) {
    if (record === null) {
      console.log("Harness idle: no holder metadata.");
    } else {
      console.log(
        `Harness idle: stale metadata (recorded pid=${record.pid} is not the live orchestrator).`,
      );
    }
    Deno.exit(0);
  }

  const now = Date.now();
  if (
    !printedFirstWait ||
    now - lastThrottlePrintAt >= HARNESS_ORCHESTRATOR_WAIT_THROTTLE_MS ||
    pid !== lastPrintedPid
  ) {
    console.log(`Waiting for test suite orchestrator at PID ${pid} to finish...`);
    lastThrottlePrintAt = now;
    printedFirstWait = true;
  }
  lastPrintedPid = pid;

  await new Promise((r) => setTimeout(r, backoff));
  backoff = Math.min(
    Math.floor(backoff * 1.5),
    HARNESS_ORCHESTRATOR_WAIT_MAX_BACKOFF_MS,
  );
}
