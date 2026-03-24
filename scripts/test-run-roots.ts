/**
 * Per-harness-invocation directory under `tests/roots/giterloper-test-runs/` for
 * `GITERLOPER_MCP_TEST_SESSION_PARENT` (see tests/README.md).
 *
 * Stale detection reuses {@link isHarnessOrchestratorRecordStale} and the same
 * manifest JSON shape as `scripts/harness-orchestrator-lock.ts`.
 */
import path from "node:path";
import {
  getStartTimeFingerprintForPid,
  type HarnessOrchestratorRecord,
  isHarnessOrchestratorRecordStale,
  parseHarnessOrchestratorRecord,
} from "./harness-orchestrator-lock.ts";

/** Relative to repository root; entire subtree is gitignored. */
export const TEST_RUN_ROOTS_MANAGED_RELATIVE = path.join(
  "tests",
  "roots",
  "giterloper-test-runs",
);

/** One line of JSON per {@link HarnessOrchestratorRecord}, same as harness meta. */
export const TEST_RUN_ROOT_MANIFEST_BASENAME = ".giterloper-test-run.meta.json";

/** Maximum run directories removed in one `allocateTestRunRoot` GC pass. */
export const MAX_TEST_RUN_GC_REMOVALS_PER_INVOCATION = 32;

/** Maximum directory entries read from the managed prefix per GC pass (then stop). */
export const MAX_TEST_RUN_GC_ENTRIES_SCANNED_PER_INVOCATION = 256;

export interface AllocateTestRunRootResult {
  /** Absolute path: set `GITERLOPER_MCP_TEST_SESSION_PARENT` to this for the harness run. */
  absoluteParent: string;
}

function isResolvedPathInside(
  parentResolved: string,
  childResolved: string,
): boolean {
  const p = parentResolved.endsWith(path.sep)
    ? parentResolved.slice(0, -1)
    : parentResolved;
  const c = childResolved.endsWith(path.sep)
    ? childResolved.slice(0, -1)
    : childResolved;
  return c === p || c.startsWith(p + path.sep);
}

export function testRunRootsManagedDir(repoRoot: string): string {
  return path.resolve(path.join(repoRoot, TEST_RUN_ROOTS_MANAGED_RELATIVE));
}

export function testRunManifestPath(runDirAbsolute: string): string {
  return path.join(runDirAbsolute, TEST_RUN_ROOT_MANIFEST_BASENAME);
}

function currentOwnerRecord(): HarnessOrchestratorRecord {
  const fpLinux = getStartTimeFingerprintForPid(Deno.pid);
  if (Deno.build.os === "linux" && (fpLinux === null || fpLinux === "")) {
    throw new Error(
      "test run root: could not read starttime fingerprint from /proc/self/stat",
    );
  }
  return {
    pid: Deno.pid,
    startTimeFingerprint: fpLinux ?? `nonlinux:${Deno.pid}`,
  };
}

async function writeManifestAtomic(
  runDir: string,
  record: HarnessOrchestratorRecord,
): Promise<void> {
  const finalPath = testRunManifestPath(runDir);
  const tmpPath = `${finalPath}.${Deno.pid}.${Date.now()}.tmp`;
  await Deno.writeTextFile(tmpPath, `${JSON.stringify(record)}\n`);
  await Deno.rename(tmpPath, finalPath);
}

/**
 * Scans only `tests/roots/giterloper-test-runs/` under `repoRoot`, removes child directories
 * whose manifest parses and is stale per {@link isHarnessOrchestratorRecordStale}.
 * Does not signal processes. Does not touch paths outside the resolved managed directory.
 */
export async function gcStaleTestRunDirs(repoRoot: string): Promise<void> {
  const absRepo = path.resolve(repoRoot);
  const managedRoot = path.resolve(
    path.join(absRepo, TEST_RUN_ROOTS_MANAGED_RELATIVE),
  );

  let scanned = 0;
  let removals = 0;

  try {
    for await (const ent of Deno.readDir(managedRoot)) {
      if (scanned >= MAX_TEST_RUN_GC_ENTRIES_SCANNED_PER_INVOCATION) break;
      scanned++;
      if (!ent.isDirectory) continue;

      const name = ent.name;
      if (name === "." || name === ".." || name.includes(path.sep)) continue;

      const runDir = path.resolve(path.join(managedRoot, name));
      if (!isResolvedPathInside(managedRoot, runDir)) continue;

      let raw: string;
      try {
        raw = await Deno.readTextFile(testRunManifestPath(runDir));
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) continue;
        throw e;
      }

      const record = parseHarnessOrchestratorRecord(raw);
      if (record === null) continue;

      if (!await isHarnessOrchestratorRecordStale(record)) continue;
      if (removals >= MAX_TEST_RUN_GC_REMOVALS_PER_INVOCATION) break;

      try {
        await Deno.remove(runDir, { recursive: true });
        removals++;
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) continue;
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;
    throw e;
  }
}

/**
 * Runs bounded GC, creates a new run directory, writes owner PID + fingerprint manifest
 * (same rules as the harness orchestrator lock), and returns its absolute path.
 */
export async function allocateTestRunRoot(
  repoRoot: string,
): Promise<AllocateTestRunRootResult> {
  const absRepo = path.resolve(repoRoot);
  await gcStaleTestRunDirs(absRepo);

  const managedRoot = path.resolve(
    path.join(absRepo, TEST_RUN_ROOTS_MANAGED_RELATIVE),
  );
  await Deno.mkdir(managedRoot, { recursive: true });

  const runId = `run-${Date.now()}-${crypto.randomUUID().replace(/-/g, "")}`;
  const runDir = path.resolve(path.join(managedRoot, runId));
  if (!isResolvedPathInside(managedRoot, runDir)) {
    throw new Error("test run root: refused path outside managed directory");
  }

  await Deno.mkdir(runDir, { recursive: false });
  await writeManifestAtomic(runDir, currentOwnerRecord());

  return { absoluteParent: runDir };
}
