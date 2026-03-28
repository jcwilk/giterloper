#!/usr/bin/env -S deno run -A
/**
 * Unified test harness: bounded worker pool schedules one `deno test` subprocess per logical case
 * discovered via AST (`scripts/discover-test-cases.ts`). Per-case isolation matches Deno 2.x concurrency
 * model (one runnable module per case). Concurrency: **`DENO_JOBS`** concurrent workers (default 16).
 *
 * Each subprocess uses `--reporter junit` and a temp report file; the harness requires ≥1 executed
 * testcase and zero failures/errors (Deno 2.7 exits 0 when all tests are filtered out—exit code alone
 * is not sufficient).
 *
 * At entry, the harness acquires a repo-root **flock** orchestrator lock (see
 * **`scripts/harness-orchestrator-lock.ts`** and **tests/README.md**) so only one parent mutates
 * shared harness state; **`ensureMemsearchOnPath`**, discovery, and **`.giterloper*`** deletion run
 * only after lock acquisition.
 *
 * Before scheduling cases, the harness removes **`<repo>/.giterloper`** and **`<repo>/.giterloper_test`**
 * if present. That **repo-root** cleanup is only to keep leftover session trees from piling up on
 * disk across repeated full-suite runs; it is **not** a substitute for per-case isolation (tests
 * still must use their own `cwd` / session ids as documented in tests/README.md). MCP test-mode
 * session trees for this harness run live under **`tests/roots/giterloper-test-runs/<runId>/`** via
 * **`GITERLOPER_MCP_TEST_SESSION_PARENT`** (see **`allocateTestRunRoot`** in **`scripts/test-run-roots.ts`**).
 *
 * Ordering (after the flock is held): **memsearch** → **discovery** → **repo-root hygiene deletion**
 * → **`allocateTestRunRoot`** (GC + new run dir) → **worker pool**. Each **`deno test`** worker
 * receives the **full** parent environment merged with that absolute session-parent path.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GITERLOPER_MCP_TEST_SESSION_PARENT } from "../lib/session-layout.ts";
import { ensureMemsearchOnPath } from "./bootstrap-memsearch.ts";
import { type DiscoveredTestCase, discoverTestCases } from "./discover-test-cases.ts";
import { acquireHarnessOrchestratorLock } from "./harness-orchestrator-lock.ts";
import { allocateTestRunRoot } from "./test-run-roots.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const orchestratorLock = await acquireHarnessOrchestratorLock(root);
let orchestratorReleased = false;
const releaseOrchestratorLock = async () => {
  if (orchestratorReleased) return;
  orchestratorReleased = true;
  await orchestratorLock.release();
};

const onHarnessSignal = () => {
  void (async () => {
    await releaseOrchestratorLock();
    Deno.exit(130);
  })();
};
Deno.addSignalListener("SIGINT", onHarnessSignal);
Deno.addSignalListener("SIGTERM", onHarnessSignal);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJUnitAttr(tag: string, name: string): number | undefined {
  const m = tag.match(new RegExp(`\\b${name}="(\\d+)"`));
  return m ? parseInt(m[1]!, 10) : undefined;
}

/** Parse Deno JUnit XML: aggregate failures/errors from root `<testsuites>`; ran = sum(tests - disabled) per `<testsuite `. */
function parseJUnitSummary(xml: string): { failures: number; errors: number; ran: number } {
  const rootMatch = xml.match(/<testsuites\s[^>]*>/);
  if (!rootMatch) throw new Error("missing <testsuites>");
  const rootTag = rootMatch[0]!;
  const failures = parseJUnitAttr(rootTag, "failures") ?? 0;
  const errors = parseJUnitAttr(rootTag, "errors") ?? 0;
  let ran = 0;
  for (const m of xml.matchAll(/<testsuite\s[^>]*>/g)) {
    const tag = m[0]!;
    const tests = parseJUnitAttr(tag, "tests") ?? 0;
    const disabled = parseJUnitAttr(tag, "disabled") ?? 0;
    ran += Math.max(0, tests - disabled);
  }
  return { failures, errors, ran };
}

function workerCount(): number {
  const j = Deno.env.get("DENO_JOBS");
  if (j) {
    const n = parseInt(j, 10);
    if (!Number.isNaN(n) && n >= 1) return n;
  }
  return 16;
}

function formatCase(c: DiscoveredTestCase): string {
  return `(${c.path}, ${JSON.stringify(c.name)})`;
}

async function runOne(
  c: DiscoveredTestCase,
  workerEnv: Record<string, string>,
): Promise<number> {
  const filter = `/^${escapeRegExp(c.name)}$/`;
  const junitPath = await Deno.makeTempFile({ prefix: "giterloper-junit-", suffix: ".xml" });
  try {
    const cmd = new Deno.Command("deno", {
      args: [
        "test",
        "-A",
        "--reporter",
        "junit",
        "--junit-path",
        junitPath,
        "--filter",
        filter,
        c.path,
      ],
      cwd: root,
      env: workerEnv,
      // JUnit reporter echoes the full XML to stdout; suppress noise while keeping stderr for Deno diagnostics.
      stdout: "null",
      stderr: "inherit",
    });
    const { code: denoCode } = await cmd.output();

    let xml: string;
    try {
      xml = await Deno.readTextFile(junitPath);
    } catch {
      console.error(`${formatCase(c)}: JUnit report missing or unreadable (deno exit ${denoCode})`);
      return 1;
    }

    let summary: { failures: number; errors: number; ran: number };
    try {
      summary = parseJUnitSummary(xml);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${formatCase(c)}: invalid JUnit XML: ${msg}`);
      return 1;
    }

    if (summary.failures > 0 || summary.errors > 0 || summary.ran < 1) {
      console.error(
        `${formatCase(c)}: JUnit gate failed (failures=${summary.failures} errors=${summary.errors} ran=${summary.ran}; deno exit ${denoCode})`,
      );
      return 1;
    }
    return 0;
  } finally {
    try {
      await Deno.remove(junitPath);
    } catch {
      /* ignore */
    }
  }
}

let exitCode = 0;
try {
  await ensureMemsearchOnPath();

  let cases: DiscoveredTestCase[];
  try {
    cases = await discoverTestCases(root);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    exitCode = 1;
    cases = [];
  }

  if (exitCode === 0) {
    console.error(`Harness: discovered ${cases.length} test case(s).`);

    if (cases.length === 0) {
      console.error("No test cases discovered under tests/; add *.test.ts files with static Deno.test names.");
      exitCode = 1;
    } else {
      for (const base of [".giterloper", ".giterloper_test"] as const) {
        const dir = path.join(root, base);
        try {
          await Deno.remove(dir, { recursive: true });
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) throw e;
        }
      }

      const { absoluteParent } = await allocateTestRunRoot(root);
      const workerEnv: Record<string, string> = {
        ...Deno.env.toObject(),
        [GITERLOPER_MCP_TEST_SESSION_PARENT]: absoluteParent,
        GITERLOPER_OPENAI_VCR: Deno.env.get("GITERLOPER_OPENAI_VCR") ?? "replay-only",
      };

      const jobs = workerCount();
      const concurrency = Math.min(jobs, cases.length);
      let nextIndex = 0;
      let failures = 0;

      async function worker(): Promise<void> {
        while (true) {
          const i = nextIndex++;
          if (i >= cases.length) return;
          const c = cases[i]!;
          const code = await runOne(c, workerEnv);
          if (code !== 0) failures++;
        }
      }

      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);

      exitCode = failures > 0 ? 1 : 0;
    }
  }
} finally {
  await releaseOrchestratorLock();
}
Deno.exit(exitCode);
