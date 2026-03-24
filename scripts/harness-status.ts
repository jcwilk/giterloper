#!/usr/bin/env -S deno run -A
/**
 * CLI: inspect harness orchestrator metadata (see tests/README.md).
 * Shared classification: `describeHarnessOrchestratorWaitContext` in `harness-orchestrator-lock.ts`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeHarnessOrchestratorWaitContext,
  harnessOrchestratorMetaPath,
} from "./harness-orchestrator-lock.ts";

const SCRIPT_HELP = `Usage: deno run -A scripts/harness-status.ts [--project-root <dir>]

Read the unified test harness orchestrator metadata and print a one-line status to stdout.

Exit codes:
  0  idle — no holder metadata (missing or empty/unparseable file)
  1  active — metadata describes a live orchestrator parent (PID alive; fingerprint matches on Linux when available)
  2  stale — metadata exists but the recorded process is dead or the fingerprint does not match the live PID

This tool does not acquire the flock, send signals, or kill any process. There is no
timeout that kills the harness or waiters. For the full lock + metadata contract, see
tests/README.md (runner and parallelism).

Paths (under project root): .giterloper-harness.lock (flock), .giterloper-harness.meta.json (metadata).

Stable task: deno task harness:status
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
const { record, stale } = await describeHarnessOrchestratorWaitContext(root);
const metaPath = harnessOrchestratorMetaPath(root);

if (record === null) {
  console.log(`idle: no holder metadata (${metaPath})`);
  Deno.exit(0);
}
if (stale) {
  console.log(
    `stale: metadata pid=${record.pid} (process dead or fingerprint mismatch vs live PID)`,
  );
  Deno.exit(2);
}

console.log(
  `active: orchestrator parent pid=${record.pid} (metadata matches live process)`,
);
Deno.exit(1);
