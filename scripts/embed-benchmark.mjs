#!/usr/bin/env node
/**
 * Reproducible benchmark for qmd embed performance.
 *
 * Usage:
 *   node scripts/embed-benchmark.mjs          # Full benchmark (setup + embed + verify)
 *   node scripts/embed-benchmark.mjs --skip   # Skip setup, use existing (for repeated runs)
 *   node scripts/embed-benchmark.mjs --gl     # Also benchmark gl index (adds bench pin)
 *
 * Sets up an isolated .giterloper state with test knowledge, runs embed, verifies via search.
 * With --gl, exercises gl index to verify the skip-when-nothing-to-embed optimization.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.join(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures", "knowledge");
const BENCH_REPO = path.join(__dirname, "bench-repo");
const BENCH_PIN = "bench_embed";
const BENCH_SHA = "a1b2c3d4e5f6789012345678901234567890abcd";
const GL_SCRIPT = path.join(WORKSPACE, ".cursor", "skills", "gl", "scripts", "gl.mjs");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: opts.cwd ?? WORKSPACE,
    env: { ...process.env, ...opts.env },
  });
  if (result.error) throw new Error(`Failed: ${cmd} ${args.join(" ")}: ${result.error.message}`);
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed: ${err}`);
  }
  return result.stdout.trim();
}

function runSoft(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: opts.cwd ?? WORKSPACE,
    env: { ...process.env, ...opts.env },
  });
  return { ok: !result.error && result.status === 0, stdout: (result.stdout || "").trim() };
}

function runQmd(indexName, args, opts = {}) {
  const env = {
    ...process.env,
    XDG_CONFIG_HOME: path.join(WORKSPACE, ".giterloper", "qmd", "config"),
    XDG_CACHE_HOME: path.join(WORKSPACE, ".giterloper", "qmd", "cache"),
    ...opts.env,
  };
  return run("npx", ["qmd", "--index", indexName, ...args], { ...opts, env });
}

function runGl(args, opts = {}) {
  return run("node", [GL_SCRIPT, ...args], { ...opts });
}

function elapsed(startMs) {
  return ((Date.now() - startMs) / 1000).toFixed(2);
}

function setupBenchState() {
  const versionsDir = path.join(WORKSPACE, ".giterloper", "versions", BENCH_PIN, BENCH_SHA);
  const knowledgeDir = path.join(versionsDir, "knowledge");
  const indexName = `${BENCH_PIN}_${BENCH_SHA}`;
  const collection = `${BENCH_PIN}@${BENCH_SHA}`;
  const sqlitePath = path.join(WORKSPACE, ".giterloper", "qmd", "cache", "qmd", `${indexName}.sqlite`);

  if (existsSync(sqlitePath)) {
    const env = {
      XDG_CONFIG_HOME: path.join(WORKSPACE, ".giterloper", "qmd", "config"),
      XDG_CACHE_HOME: path.join(WORKSPACE, ".giterloper", "qmd", "cache"),
    };
    runSoft("npx", ["qmd", "--index", indexName, "context", "rm", `qmd://${collection}`], { env });
    runSoft("npx", ["qmd", "--index", indexName, "collection", "remove", collection], { env });
    try { rmSync(sqlitePath); } catch {}
  }
  if (existsSync(versionsDir)) rmSync(versionsDir, { recursive: true });
  mkdirSync(knowledgeDir, { recursive: true });
  cpSync(FIXTURES, knowledgeDir, { recursive: true });

  const configDir = path.join(WORKSPACE, ".giterloper", "qmd", "config", "qmd");
  const cacheDir = path.join(WORKSPACE, ".giterloper", "qmd", "cache", "qmd");
  mkdirSync(configDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  // Add collection and context
  runQmd(indexName, [
    "collection",
    "add",
    knowledgeDir,
    "--name",
    `${BENCH_PIN}@${BENCH_SHA}`,
    "--mask",
    "**/*.md",
  ]);
  runQmd(indexName, [
    "context",
    "add",
    `qmd://${BENCH_PIN}@${BENCH_SHA}`,
    `${BENCH_PIN} at ${BENCH_SHA}`,
  ]);

  return { indexName, collection: `${BENCH_PIN}@${BENCH_SHA}` };
}

function countEmbedded(indexName) {
  const status = runQmd(indexName, ["status"]);
  const vectorsMatch = status.match(/Vectors:\s+(\d+)\s+embedded/i);
  const pendingMatch = status.match(/Pending:\s+(\d+)\s+need embedding/i);
  return {
    vectors: vectorsMatch ? parseInt(vectorsMatch[1], 10) : 0,
    pending: pendingMatch ? parseInt(pendingMatch[1], 10) : 0,
  };
}

function ensureBenchRepo() {
  if (!existsSync(path.join(BENCH_REPO, ".git"))) {
    mkdirSync(path.join(BENCH_REPO, "knowledge"), { recursive: true });
    cpSync(FIXTURES, path.join(BENCH_REPO, "knowledge"), { recursive: true });
    run("git", ["init"], { cwd: BENCH_REPO });
    run("git", ["config", "user.email", "b@b.com"], { cwd: BENCH_REPO });
    run("git", ["config", "user.name", "Bench"], { cwd: BENCH_REPO });
    run("git", ["add", "."], { cwd: BENCH_REPO });
    run("git", ["commit", "-m", "init"], { cwd: BENCH_REPO });
  }
  return run("git", ["rev-parse", "HEAD"], { cwd: BENCH_REPO }).trim();
}

function main() {
  const skipSetup = process.argv.includes("--skip");
  const runGlBench = process.argv.includes("--gl");

  if (!existsSync(FIXTURES)) {
    console.error("fixtures/knowledge/ not found. Create it with some .md files.");
    process.exit(1);
  }

  let indexName, collection;
  if (skipSetup) {
    indexName = `${BENCH_PIN}_${BENCH_SHA}`;
    collection = `${BENCH_PIN}@${BENCH_SHA}`;
    const cacheDir = path.join(WORKSPACE, ".giterloper", "qmd", "cache", "qmd");
    if (!existsSync(path.join(cacheDir, `${indexName}.sqlite`))) {
      console.error("No existing bench state. Run without --skip first.");
      process.exit(1);
    }
  } else {
    ({ indexName, collection } = setupBenchState());
  }

  const env = {
    XDG_CONFIG_HOME: path.join(WORKSPACE, ".giterloper", "qmd", "config"),
    XDG_CACHE_HOME: path.join(WORKSPACE, ".giterloper", "qmd", "cache"),
  };

  // 1. Measure "already embedded" case (should be fast with skip optimization)
  const before = countEmbedded(indexName);
  console.log(`Pre-check: vectors=${before.vectors} pending=${before.pending}`);

  let t0 = Date.now();
  runQmd(indexName, ["embed"], { env });
  const embedTimeSec = elapsed(t0);
  console.log(`qmd embed (first or re-run): ${embedTimeSec}s`);

  // 2. Verify embeddings exist
  const after = countEmbedded(indexName);
  console.log(`Post-check: vectors=${after.vectors} pending=${after.pending}`);

  if (after.vectors === 0 && before.pending > 0) {
    console.error("ERROR: Embedding appears to have been skipped but vectors=0");
    process.exit(1);
  }

  // 3. Verify search returns results (proves embedding worked)
  const searchOut = runQmd(indexName, ["vsearch", "giterloper knowledge", "-c", collection, "-n", "1"]);
  if (!searchOut || searchOut.includes("No results")) {
    console.error("ERROR: vsearch returned no results - embedding may not have worked");
    process.exit(1);
  }
  console.log("Verify: vsearch returned results OK");

  // 4. Second run - measure "nothing to do" case (baseline: qmd always runs)
  t0 = Date.now();
  runQmd(indexName, ["embed"], { env });
  const embedNoWorkSec = elapsed(t0);
  console.log(`qmd embed (no work needed): ${embedNoWorkSec}s`);

  console.log("\n--- Summary ---");
  console.log(`First/relevant embed: ${embedTimeSec}s`);
  console.log(`No-work embed (qmd direct): ${embedNoWorkSec}s`);

  // 5. Optional: benchmark gl index with skip optimization
  if (runGlBench) {
    ensureBenchRepo();
    const repoUrl = `file://${path.resolve(BENCH_REPO)}`;
    console.log("\n--- gl index benchmark ---");
    runGl(["pin", "add", BENCH_PIN, repoUrl]);
    t0 = Date.now();
    runGl(["index", "--pin", BENCH_PIN]);
    const glIndexSec = elapsed(t0);
    console.log(`gl index (skip embed, already indexed): ${glIndexSec}s`);
    runGl(["pin", "remove", BENCH_PIN]);
    console.log(`\nSkip optimization: avoids qmd embed (~${embedNoWorkSec}s) when nothing needs embedding`);
  }
}

main();
