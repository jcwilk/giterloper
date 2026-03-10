#!/usr/bin/env -S deno run -A
/**
 * Reproducible benchmark for qmd embed performance.
 *
 * Creates a fixture knowledge directory, indexes it with qmd, times the embed
 * phase, and verifies embeddings work via vsearch (semantic search).
 *
 * Usage: deno run -A scripts/benchmark-embed.ts [--runs N] [--fixture-dir PATH]
 *
 * Environment:
 *   - Uses XDG_CONFIG_HOME and XDG_CACHE_HOME under .giterloper-bench/ to avoid
 *     touching production .giterloper/ state.
 *   - NODE_LLAMA_CPP_GPU=false for consistent CPU benchmarking.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const BENCH_ROOT = path.join(WORKSPACE, ".giterloper-bench");
const CONFIG_HOME = path.join(BENCH_ROOT, "qmd", "config");
const CACHE_HOME = path.join(BENCH_ROOT, "qmd", "cache");
const INDEX_NAME = "benchmark_embed_fixture";

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function createFixture(opts: { dir?: string } = {}): { fixtureDir: string; knowledge: string } {
  const fixtureDir = opts.dir ?? path.join(tmpdir(), `giterloper-embed-fixture-${Date.now()}`);
  ensureDir(fixtureDir);
  const knowledge = path.join(fixtureDir, "knowledge");
  ensureDir(knowledge);

  const sources: [string, string][] = [
    ["AGENTS.md", path.join(WORKSPACE, "AGENTS.md")],
    ["README.md", path.join(WORKSPACE, "README.md")],
    ["CONSTITUTION.md", path.join(WORKSPACE, "CONSTITUTION.md")],
  ];
  for (const [name, src] of sources) {
    if (existsSync(src)) {
      writeFileSync(path.join(knowledge, name), readFileSync(src, "utf8"), "utf8");
    }
  }

  writeFileSync(
    path.join(knowledge, "embed-test-marker.md"),
    "# Embed Test Marker\n\nThis document contains the unique phrase `semantic-embed-verification-marker` for benchmark verification.",
    "utf8"
  );

  return { fixtureDir, knowledge };
}

function runQmd(args: string[], env: Record<string, string> = {}): { ok: boolean; stdout: string; stderr: string; status: number } {
  const result = spawnSync("qmd", ["--index", INDEX_NAME, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...Deno.env.toObject(),
      XDG_CONFIG_HOME: CONFIG_HOME,
      XDG_CACHE_HOME: CACHE_HOME,
      NODE_LLAMA_CPP_GPU: "false",
      ...env,
    },
  });
  return {
    ok: !result.error && result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status ?? 1,
  };
}

function verifyEmbedding(): { ok: boolean; reason: string; stderr?: string; hits?: unknown[] } {
  const out = runQmd(["vsearch", "semantic-embed-verification-marker", "-c", INDEX_NAME, "-n", "1", "--json"]);
  if (!out.ok) return { ok: false, reason: "vsearch failed", stderr: out.stderr };
  try {
    const parsed = JSON.parse(out.stdout) as unknown[] | { results?: unknown[] };
    const hits = Array.isArray(parsed) ? parsed : parsed?.results ?? [];
    const found = (hits as { path?: string; filepath?: string; file?: string; text?: string }[]).some(
      (r) =>
        (r.path || r.filepath || r.file || "").includes("embed-test-marker") ||
        (r.text || "").includes("semantic-embed-verification-marker")
    );
    return { ok: found, reason: found ? "marker found" : "marker not in results", hits };
  } catch {
    return { ok: false, reason: "invalid vsearch json" };
  }
}

function main(): void {
  const args = Deno.args;
  let runs = 1;
  let fixtureDir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runs" && args[i + 1]) {
      runs = Math.max(1, parseInt(args[i + 1], 10));
      i++;
    } else if (args[i] === "--fixture-dir" && args[i + 1]) {
      fixtureDir = args[i + 1];
      i++;
    }
  }

  console.log("=== qmd embed benchmark ===\n");
  ensureDir(BENCH_ROOT);
  ensureDir(path.join(CONFIG_HOME, "qmd"));
  ensureDir(path.join(CACHE_HOME, "qmd"));

  const { knowledge } = createFixture({ dir: fixtureDir ?? undefined });
  console.log(`Fixture: ${knowledge}`);
  const files = readdirSync(knowledge).filter((f) => f.endsWith(".md"));
  console.log(`  Files: ${files.length} (${files.join(", ")})\n`);

  runQmd(["collection", "remove", INDEX_NAME]);
  runQmd(["context", "rm", `qmd://${INDEX_NAME}`]);

  runQmd(["collection", "add", knowledge, "--name", INDEX_NAME, "--mask", "**/*.md"]);
  runQmd(["context", "add", `qmd://${INDEX_NAME}`, "benchmark fixture"]);

  const times: number[] = [];
  for (let r = 0; r < runs; r++) {
    const encoder = new TextEncoder();
    Deno.stderr.write(encoder.encode(`Run ${r + 1}/${runs}... `));
    const start = Date.now();
    const out = runQmd(["embed", "-f"]);
    const elapsed = Date.now() - start;
    times.push(elapsed);
    Deno.stderr.write(encoder.encode(out.ok ? `${(elapsed / 1000).toFixed(1)}s\n` : `FAIL\n`));
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(`\nEmbed times: avg ${(avg / 1000).toFixed(1)}s, min ${(min / 1000).toFixed(1)}s, max ${(max / 1000).toFixed(1)}s`);

  const verify = verifyEmbedding();
  console.log(`\nVerification (vsearch): ${verify.ok ? "PASS" : "FAIL"} - ${verify.reason}`);

  if (!verify.ok) {
    Deno.exit(1);
  }

  console.log("\nBenchmark complete.");
}

main();
