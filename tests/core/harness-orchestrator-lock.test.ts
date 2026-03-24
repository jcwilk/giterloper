/**
 * Harness-only: orchestrator lock for `scripts/run-tests.ts` (see tests/README.md).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeHarnessOrchestratorWaitContext,
  flockCliAvailable,
  harnessOrchestratorMetaPath,
} from "../../scripts/harness-orchestrator-lock.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workerPath = path.join(
  repoRoot,
  "tests/helpers/harness-orchestrator-lock-selftest-worker.ts",
);

Deno.test("harness orchestrator lock: second process blocks until first releases", async () => {
  if (!await flockCliAvailable()) return;

  const tmp = await Deno.makeTempDir();
  const holdMs = 1200;
  const readyPath = path.join(tmp, ".giterloper-harness-selftest-ready");
  const p1 = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", workerPath, tmp, String(holdMs)],
    cwd: repoRoot,
    stdout: "null",
    stderr: "null",
  }).spawn();

  for (let i = 0; i < 100; i++) {
    try {
      await Deno.stat(readyPath);
      break;
    } catch {
      if (i === 99) throw new Error("timed out waiting for first worker to acquire lock");
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  const t0 = Date.now();
  const p2 = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", workerPath, tmp, "0"],
    cwd: repoRoot,
    stdout: "null",
    stderr: "null",
  }).output();
  const elapsed = Date.now() - t0;

  assert(p2.success, `second worker should exit 0, got code ${p2.code}`);
  assert(
    elapsed >= 800,
    `second worker should block behind first (elapsed ${elapsed}ms, expected >= 800ms)`,
  );

  const s1 = await p1.status;
  assert(s1.success, `first worker should exit 0, got code ${s1.code}`);
});

Deno.test("describeHarnessOrchestratorWaitContext: missing metadata is idle", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const { record, stale } = await describeHarnessOrchestratorWaitContext(tmp);
    assert(record === null, "expected no record");
    assert(stale === false, "stale must be false without a record");
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("describeHarnessOrchestratorWaitContext: nonexistent pid is stale", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const meta = harnessOrchestratorMetaPath(tmp);
    await Deno.writeTextFile(
      meta,
      `${JSON.stringify({ pid: 999_999_001, startTimeFingerprint: "0" })}\n`,
    );
    const { record, stale } = await describeHarnessOrchestratorWaitContext(tmp);
    assert(record !== null, "expected parsed record");
    assert(stale === true, "dead pid must be stale");
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}
