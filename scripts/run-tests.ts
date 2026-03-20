#!/usr/bin/env -S deno run -A
/**
 * Unified test harness: bounded worker pool schedules one `deno test` subprocess per logical case
 * (see tests/test-case-manifest.json). Per-case isolation matches Deno 2.x concurrency model (one runnable
 * module per case). Concurrency: DENO_JOBS (workers, default 8); tests/cli + tests/mcp share
 * GITERLOPER_REMOTE_TEST_CONCURRENCY (default 1). No suite-wide .giterloper sweep.
 *
 * Regenerate the manifest after adding or renaming tests: `deno task gen:test-manifest`
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "tests", "test-case-manifest.json");

interface ManifestCase {
  path: string;
  name: string;
}

/** CLI/MCP cases hit the shared test knowledge remote; cap overlap to reduce git/GitHub contention. */
function isRemoteIntegrationCase(p: string): boolean {
  return p.startsWith("tests/cli/") || p.startsWith("tests/mcp/");
}

class Semaphore {
  #max: number;
  #active = 0;
  #q: Array<() => void> = [];

  constructor(max: number) {
    this.#max = max;
  }

  async acquire(): Promise<void> {
    if (this.#active < this.#max) {
      this.#active++;
      return;
    }
    await new Promise<void>((resolve) => this.#q.push(resolve));
    this.#active++;
  }

  release(): void {
    this.#active--;
    const next = this.#q.shift();
    if (next) next();
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function workerCount(): number {
  const j = Deno.env.get("DENO_JOBS");
  if (j) {
    const n = parseInt(j, 10);
    if (!Number.isNaN(n) && n >= 1) return n;
  }
  return 8;
}

/** Max concurrent subprocesses for tests/cli and tests/mcp (shared remote + heavy git). Default 1. */
function remoteIntegrationConcurrency(jobs: number): number {
  const raw = Deno.env.get("GITERLOPER_REMOTE_TEST_CONCURRENCY");
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 1) return Math.min(n, jobs);
  }
  return 1;
}

async function runOne(c: ManifestCase): Promise<number> {
  // Deno expects a /pattern/ regexp for anchored full-name match (plain string is substring).
  const filter = `/^${escapeRegExp(c.name)}$/`;
  const cmd = new Deno.Command("deno", {
    args: ["test", "-A", "--filter", filter, c.path],
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  return code;
}

const raw = await Deno.readTextFile(manifestPath);
const manifest = JSON.parse(raw) as { cases: ManifestCase[] };
const cases = manifest.cases;
if (cases.length === 0) {
  console.error("No test cases in manifest; run: deno task gen:test-manifest");
  Deno.exit(1);
}

const jobs = workerCount();
const concurrency = Math.min(jobs, cases.length);
const remoteSem = new Semaphore(remoteIntegrationConcurrency(jobs));
let nextIndex = 0;
let failures = 0;

async function worker(): Promise<void> {
  while (true) {
    const i = nextIndex++;
    if (i >= cases.length) return;
    const c = cases[i];
    if (isRemoteIntegrationCase(c.path)) {
      await remoteSem.acquire();
      try {
        const code = await runOne(c);
        if (code !== 0) failures++;
      } finally {
        remoteSem.release();
      }
    } else {
      const code = await runOne(c);
      if (code !== 0) failures++;
    }
  }
}

const workers = Array.from({ length: concurrency }, () => worker());
await Promise.all(workers);

Deno.exit(failures > 0 ? 1 : 0);
