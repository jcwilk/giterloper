/**
 * Single active orchestrator lock for the unified test harness (`scripts/run-tests.ts`).
 * Shared with other tooling (e.g. harness status / wait-for-idle) so paths and parsing stay aligned.
 *
 * ## Mechanism (see tests/README.md)
 *
 * Advisory **LOCK_EX** via **`flock(1)`**: a child process runs
 * `flock -n -x <lockfile> sh -c 'printf …; exec cat'` with stdin piped from the parent. The child
 * keeps the lock until the parent closes that stdin (typically in `finally`), so the lock is not
 * held in a try-then-exit wrapper that would release immediately.
 *
 * **Metadata** (orchestrator **parent** PID + start-time fingerprint) lives in a separate file,
 * updated with **write temp + rename** only after the lock is held, so waiters can `read(2)` it
 * without taking LOCK_EX.
 */
import path from "node:path";

/** Basename of the flock inode (repo root). Not under `.giterloper` / `.giterloper_test`. */
export const HARNESS_ORCHESTRATOR_LOCK_BASENAME = ".giterloper-harness.lock";

/** JSON record of the active orchestrator parent (one line of JSON). */
export const HARNESS_ORCHESTRATOR_META_BASENAME = ".giterloper-harness.meta.json";

export interface HarnessOrchestratorRecord {
  pid: number;
  /** Linux: starttime field from `/proc/<pid>/stat`. Opaque string compared for equality. */
  startTimeFingerprint: string;
}

export function harnessOrchestratorLockPath(projectRoot: string): string {
  return path.join(projectRoot, HARNESS_ORCHESTRATOR_LOCK_BASENAME);
}

export function harnessOrchestratorMetaPath(projectRoot: string): string {
  return path.join(projectRoot, HARNESS_ORCHESTRATOR_META_BASENAME);
}

export function parseHarnessOrchestratorRecord(text: string): HarnessOrchestratorRecord | null {
  const line = text.trim().split(/\r?\n/)[0]?.trim();
  if (!line) return null;
  try {
    const v = JSON.parse(line) as unknown;
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    const pid = o.pid;
    const startTimeFingerprint = o.startTimeFingerprint;
    if (typeof pid !== "number" || !Number.isInteger(pid) || pid < 1) return null;
    if (typeof startTimeFingerprint !== "string" || startTimeFingerprint.length === 0) return null;
    return { pid, startTimeFingerprint };
  } catch {
    return null;
  }
}

export async function readHarnessOrchestratorRecord(
  projectRoot: string,
): Promise<HarnessOrchestratorRecord | null> {
  const p = harnessOrchestratorMetaPath(projectRoot);
  let raw: string;
  try {
    raw = await Deno.readTextFile(p);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
  return parseHarnessOrchestratorRecord(raw);
}

/** True if `kill -0` (or equivalent) says the PID exists in this OS session. */
export async function isPidAlive(pid: number): Promise<boolean> {
  const r = await new Deno.Command("kill", {
    args: ["-0", String(pid)],
    stdout: "null",
    stderr: "null",
  }).output();
  return r.success;
}

/**
 * Linux: read field **starttime** from `/proc/<pid>/stat` (anti–PID-reuse fingerprint).
 * Returns `null` if unavailable (non-Linux or parse failure).
 */
export function getStartTimeFingerprintForPid(pid: number): string | null {
  if (Deno.build.os !== "linux") return null;
  try {
    const raw = Deno.readTextFileSync(`/proc/${pid}/stat`);
    const rp = raw.indexOf(") ");
    if (rp === -1) return null;
    const rest = raw.slice(rp + 2);
    const fields = rest.split(/\s+/);
    const starttime = fields[19];
    if (!starttime) return null;
    return starttime;
  } catch {
    return null;
  }
}

/**
 * Stale if the PID is dead, or (when fingerprint is available) fingerprint does not match live process.
 * On non-Linux, fingerprint is unavailable from `/proc`; callers should treat **alive PID** as
 * non-stale and rely on lock lifetime + `kill -0` only (documented limitation: PID reuse window).
 */
export async function isHarnessOrchestratorRecordStale(
  record: HarnessOrchestratorRecord,
): Promise<boolean> {
  if (!await isPidAlive(record.pid)) return true;
  const liveFp = getStartTimeFingerprintForPid(record.pid);
  if (liveFp === null) return false;
  return liveFp !== record.startTimeFingerprint;
}

export async function flockCliAvailable(): Promise<boolean> {
  const r = await new Deno.Command("flock", {
    args: ["--version"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  return r.success;
}

function formatRecordLine(record: HarnessOrchestratorRecord): string {
  return `${JSON.stringify(record)}\n`;
}

async function writeMetaAtomic(projectRoot: string, record: HarnessOrchestratorRecord): Promise<void> {
  const finalPath = harnessOrchestratorMetaPath(projectRoot);
  const tmpPath = `${finalPath}.${Deno.pid}.${Date.now()}.tmp`;
  await Deno.writeTextFile(tmpPath, formatRecordLine(record));
  await Deno.rename(tmpPath, finalPath);
}

async function removeMetaIfMatches(
  projectRoot: string,
  record: HarnessOrchestratorRecord,
): Promise<void> {
  const cur = await readHarnessOrchestratorRecord(projectRoot);
  if (
    cur &&
    cur.pid === record.pid &&
    cur.startTimeFingerprint === record.startTimeFingerprint
  ) {
    try {
      await Deno.remove(harnessOrchestratorMetaPath(projectRoot));
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
}

async function tryAcquireHolderProcess(lockPath: string): Promise<Deno.ChildProcess | null> {
  const proc = new Deno.Command("flock", {
    args: ["-n", "-x", lockPath, "sh", "-c", "printf 'ACQUIRED\\n'; exec cat"],
    stdin: "piped",
    stdout: "piped",
    stderr: "inherit",
  }).spawn();

  const decoder = new TextDecoder();
  let acc = "";

  const readPromise = (async (): Promise<boolean> => {
    const reader = proc.stdout.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (acc.includes("ACQUIRED\n")) return true;
      }
      return acc.includes("ACQUIRED\n");
    } finally {
      reader.releaseLock();
    }
  })();

  const statusPromise = proc.status.then((st) => ({ kind: "exit" as const, st }));

  const winner = await Promise.race([
    readPromise.then((ok) => ({ kind: "read" as const, ok })),
    statusPromise,
  ]);

  if (winner.kind === "exit") {
    const ok = await readPromise.catch(() => false);
    await proc.status;
    if (!winner.st.success) return null;
    return ok ? proc : null;
  }

  if (!winner.ok) {
    try {
      await proc.stdin.close();
    } catch {
      /* ignore */
    }
    await proc.status;
    return null;
  }

  return proc;
}

export interface HarnessOrchestratorLockHandle {
  release: () => Promise<void>;
}

const THROTTLE_MS = 3000;
const INITIAL_BACKOFF_MS = 50;
const MAX_BACKOFF_MS = 2000;

/**
 * Blocks until this process holds the harness flock (via a dedicated child), writes metadata, then returns.
 * Emits **stdout** wait lines per ticket; caller runs harness work afterward and must call `release()` in `finally`.
 */
export async function acquireHarnessOrchestratorLock(
  projectRoot: string,
): Promise<HarnessOrchestratorLockHandle> {
  if (!await flockCliAvailable()) {
    throw new Error(
      "harness orchestrator lock requires the `flock` utility (e.g. util-linux). Install it or use a supported OS.",
    );
  }

  const lockPath = harnessOrchestratorLockPath(projectRoot);
  let backoff = INITIAL_BACKOFF_MS;
  let lastPrintedPid: number | undefined;
  let lastThrottlePrintAt = 0;
  let printedFirstWait = false;

  while (true) {
    const proc = await tryAcquireHolderProcess(lockPath);
    if (proc !== null) {
      const fpLinux = getStartTimeFingerprintForPid(Deno.pid);
      if (Deno.build.os === "linux" && (fpLinux === null || fpLinux === "")) {
        try {
          await proc.stdin.close();
        } catch {
          /* ignore */
        }
        await proc.status;
        throw new Error(
          "harness lock: could not read starttime fingerprint from /proc/self/stat",
        );
      }
      const record: HarnessOrchestratorRecord = {
        pid: Deno.pid,
        startTimeFingerprint: fpLinux ?? `nonlinux:${Deno.pid}`,
      };
      await writeMetaAtomic(projectRoot, record);
      console.log(`Lock acquired, running test suite as PID ${Deno.pid}`);

      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          try {
            await proc.stdin.close();
          } catch {
            /* ignore */
          }
          await proc.status;
          await removeMetaIfMatches(projectRoot, record);
        },
      };
    }

    const rec = await readHarnessOrchestratorRecord(projectRoot);
    const stale = rec !== null && await isHarnessOrchestratorRecordStale(rec);
    const pid = rec !== null && !stale ? rec.pid : undefined;
    const now = Date.now();

    if (
      lastPrintedPid !== undefined &&
      pid !== undefined &&
      pid !== lastPrintedPid
    ) {
      console.log(
        `Another process acquired the test suite lock; waiting for orchestrator at PID ${pid} to finish...`,
      );
    } else if (
      !printedFirstWait ||
      now - lastThrottlePrintAt >= THROTTLE_MS ||
      (pid !== undefined && pid !== lastPrintedPid)
    ) {
      if (pid !== undefined) {
        console.log(
          `Waiting for previous test suite orchestrator at PID ${pid} to finish...`,
        );
      } else if (stale) {
        console.log(
          "Waiting for test suite lock (stale holder record on disk; will acquire when the lock object is free)...",
        );
      } else {
        console.log("Waiting for test suite lock...");
      }
      lastThrottlePrintAt = now;
      printedFirstWait = true;
    }

    lastPrintedPid = pid;
    await new Promise((r) => setTimeout(r, backoff));
    backoff = Math.min(Math.floor(backoff * 1.5), MAX_BACKOFF_MS);
  }
}
