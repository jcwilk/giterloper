#!/usr/bin/env -S deno run -A
/**
 * Subprocess helper for `tests/core/harness-orchestrator-lock.test.ts`: acquire project-root lock,
 * hold for `holdMs`, release. Args: `<projectRoot>` `<holdMs>`.
 */
import path from "node:path";

import { acquireHarnessOrchestratorLock } from "../../scripts/harness-orchestrator-lock.ts";

const projectRoot = Deno.args[0];
const holdMs = parseInt(Deno.args[1] ?? "0", 10);
if (!projectRoot || Number.isNaN(holdMs) || holdMs < 0) {
  console.error("usage: harness-orchestrator-lock-selftest-worker.ts <projectRoot> <holdMs>");
  Deno.exit(2);
}

const { release } = await acquireHarnessOrchestratorLock(projectRoot);
const readyPath = path.join(projectRoot, ".giterloper-harness-selftest-ready");
await Deno.writeTextFile(readyPath, `${Deno.pid}\n`);
try {
  await new Promise((r) => setTimeout(r, holdMs));
} finally {
  try {
    await Deno.remove(readyPath);
  } catch {
    /* ignore */
  }
  await release();
}
