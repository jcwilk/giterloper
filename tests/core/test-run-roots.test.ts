/**
 * Harness-only: per-run directory under `tests/roots/` for `GITERLOPER_MCP_TEST_SESSION_PARENT`
 * (see tests/README.md).
 */
import { assert, assertRejects } from "jsr:@std/assert";
import path from "node:path";

import {
  allocateTestRunRoot,
  gcStaleTestRunDirs,
  MAX_TEST_RUN_GC_REMOVALS_PER_INVOCATION,
  TEST_RUN_ROOT_MANIFEST_BASENAME,
  testRunManifestPath,
  testRunRootsManagedDir,
} from "../../scripts/test-run-roots.ts";
import { parseHarnessOrchestratorRecord } from "../../scripts/harness-orchestrator-lock.ts";

async function countRunDirs(managed: string): Promise<number> {
  let n = 0;
  try {
    for await (const ent of Deno.readDir(managed)) {
      if (ent.isDirectory) n++;
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return 0;
    throw e;
  }
  return n;
}

Deno.test("allocateTestRunRoot creates managed dir, manifest, and absoluteParent", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const { absoluteParent } = await allocateTestRunRoot(tmp);
    const managed = testRunRootsManagedDir(tmp);
    assert(
      absoluteParent.startsWith(managed + path.sep) || absoluteParent === managed,
      `expected under managed root: ${absoluteParent}`,
    );
    const st = await Deno.stat(absoluteParent);
    assert(st.isDirectory);
    const raw = await Deno.readTextFile(testRunManifestPath(absoluteParent));
    const rec = parseHarnessOrchestratorRecord(raw);
    assert(rec !== null);
    assert(rec.pid === Deno.pid);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("gcStaleTestRunDirs removes only provably stale run dirs", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const managed = testRunRootsManagedDir(tmp);
    await Deno.mkdir(path.join(managed, "stale-dead-pid"), { recursive: true });
    await Deno.writeTextFile(
      path.join(managed, "stale-dead-pid", TEST_RUN_ROOT_MANIFEST_BASENAME),
      `${JSON.stringify({ pid: 999_999_002, startTimeFingerprint: "0" })}\n`,
    );
    await Deno.mkdir(path.join(managed, "no-manifest"), { recursive: true });
    await Deno.writeTextFile(path.join(managed, "no-manifest", "readme.txt"), "x");

    await gcStaleTestRunDirs(tmp);

    await assertRejects(async () => await Deno.stat(path.join(managed, "stale-dead-pid")));
    await Deno.stat(path.join(managed, "no-manifest"));
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("gcStaleTestRunDirs respects max removals per invocation", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const managed = testRunRootsManagedDir(tmp);
    const total = MAX_TEST_RUN_GC_REMOVALS_PER_INVOCATION + 5;
    for (let i = 0; i < total; i++) {
      const name = `stale-${i}`;
      await Deno.mkdir(path.join(managed, name), { recursive: true });
      await Deno.writeTextFile(
        path.join(managed, name, TEST_RUN_ROOT_MANIFEST_BASENAME),
        `${JSON.stringify({ pid: 999_999_003, startTimeFingerprint: String(i) })}\n`,
      );
    }
    await gcStaleTestRunDirs(tmp);
    const remaining = await countRunDirs(managed);
    assert(
      remaining === 5,
      `expected 5 dirs left after cap, got ${remaining}`,
    );
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});
