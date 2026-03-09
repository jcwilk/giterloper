#!/usr/bin/env node
/**
 * Reproducible benchmark for qmd embed performance.
 *
 * Usage:
 *   npm run bench:embed [-- --teardown-first] [-- --runs N] [-- --verify]
 *
 * Creates a test index with sample markdown, runs embed, and reports timing.
 * --teardown-first: clear and re-embed from scratch (measures full embed).
 * --runs N: run N times and report min/avg/max.
 * --verify: run search after embed to confirm semantic search works.
 *
 * Typical results (5 docs, CPU): full embed ~4s, skip path ~0.24s.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GITERLOPER = path.join(ROOT, ".giterloper");
const BENCH_INDEX = "embed_bench";
const BENCH_VERSION = "bench001";
const BENCH_CLONE = path.join(GITERLOPER, "versions", BENCH_INDEX, BENCH_VERSION);
const BENCH_KNOWLEDGE = path.join(BENCH_CLONE, "knowledge");

const SAMPLE_DOCS = [
  {
    file: "overview.md",
    content: `# Giterloper Overview

Giterloper is a Git-backed knowledge storage system. It stores knowledge in markdown
files within a Git repository, enabling versioning, branching, and merging.

Key features include: semantic search via embeddings, full-text search, and
agent-friendly MCP integration.`,
  },
  {
    file: "setup.md",
    content: `# Setup Instructions

To set up giterloper, run \`gl pin add <name> <source>\` to add a knowledge store.
Then run \`gl clone\` and \`gl index\` to fetch and index the content.

Ensure Node.js 22+ and Git are installed. The embedding model downloads on first use.`,
  },
  {
    file: "workflows.md",
    content: `# Common Workflows

## Adding Knowledge
Use \`gl add\` to queue content from stdin. Reconcile with \`gl reconcile\`
to merge into the knowledge store.

## Searching
Use \`gl search\` for keyword search or \`gl query\` for semantic search.
Both support \`--pin\` to target a specific store.`,
  },
  {
    file: "technical.md",
    content: `# Technical Details

The system uses QMD for indexing: SQLite FTS5 for full-text and sqlite-vec
for vector similarity. Embeddings are generated via embeddinggemma or
configurable models via QMD_EMBED_MODEL.`,
  },
  {
    file: "troubleshooting.md",
    content: `# Troubleshooting

If embed is slow: ensure no other embed is running (single lock).
If search returns nothing: run \`gl index\` to refresh embeddings.
For GPU: run \`gl gpu\` to detect CUDA; use \`gl gpu --cpu\` to force CPU.`,
  },
];

function ensureBenchData() {
  mkdirSync(BENCH_KNOWLEDGE, { recursive: true });
  for (const doc of SAMPLE_DOCS) {
    const p = path.join(BENCH_KNOWLEDGE, doc.file);
    if (!existsSync(p) || readFileSync(p, "utf8") !== doc.content) {
      writeFileSync(p, doc.content + "\n", "utf8");
    }
  }
}

function teardownBenchIndex() {
  const indexName = `${BENCH_INDEX}_${BENCH_VERSION}`;
  const collection = `${BENCH_INDEX}@${BENCH_VERSION}`;
  try {
    runQmd(["context", "rm", `qmd://${collection}`]);
  } catch {}
  try {
    runQmd(["collection", "remove", collection]);
  } catch {}
  const cacheDir = path.join(GITERLOPER, "qmd", "cache", "qmd");
  const configDir = path.join(GITERLOPER, "qmd", "config", "qmd");
  for (const dir of [cacheDir, configDir]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f === `${indexName}.sqlite` || f.startsWith(`${indexName}.`)) {
        try {
          unlinkSync(path.join(dir, f));
        } catch {}
      }
    }
  }
}

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout?.trim() || "";
}

function runQmd(args, env = {}) {
  const baseEnv = {
    XDG_CONFIG_HOME: path.join(GITERLOPER, "qmd", "config"),
    XDG_CACHE_HOME: path.join(GITERLOPER, "qmd", "cache"),
  };
  return run("qmd", ["--index", `${BENCH_INDEX}_${BENCH_VERSION}`, ...args], { ...baseEnv, ...env });
}

function timeEmbed() {
  const start = performance.now();
  runQmd(["embed"]);
  return (performance.now() - start) / 1000;
}

function setupCollection() {
  const collection = `${BENCH_INDEX}@${BENCH_VERSION}`;
  try {
    runQmd(["collection", "list"]);
  } catch {
    // No collection yet
  }
  const list = runQmd(["collection", "list"]);
  if (!list.includes(collection)) {
    runQmd([
      "collection", "add", BENCH_KNOWLEDGE,
      "--name", collection,
      "--mask", "**/*.md",
    ]);
  }
  const ctxList = runQmd(["context", "list"]);
  if (!ctxList.includes(collection)) {
    runQmd(["context", "add", `qmd://${collection}`, `${BENCH_INDEX} at ${BENCH_VERSION}`]);
  }
}

function verifyEmbedding() {
  const out = runQmd(["search", "giterloper setup", "-c", `${BENCH_INDEX}@${BENCH_VERSION}`, "-n", "2", "--json"]);
  const results = JSON.parse(out || "[]");
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Search returned no results - embedding may have failed");
  }
  const hasRelevant = results.some((r) => {
    const text = (r.text || r.snippet || "").toLowerCase();
    return text.includes("setup") || text.includes("pin") || text.includes("clone");
  });
  if (!hasRelevant) {
    throw new Error("Search results do not look relevant - embedding may be wrong");
  }
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const teardownFirst = args.includes("--teardown-first");
  const verify = args.includes("--verify");
  const runsIdx = args.indexOf("--runs");
  const runs = runsIdx >= 0 && args[runsIdx + 1] ? parseInt(args[runsIdx + 1], 10) : 1;

  mkdirSync(GITERLOPER, { recursive: true });
  ensureBenchData();

  if (teardownFirst) {
    teardownBenchIndex();
  }

  setupCollection();

  const times = [];
  for (let i = 0; i < runs; i++) {
    if (teardownFirst && i > 0) {
      teardownBenchIndex();
      setupCollection();
    }
    const sec = timeEmbed();
    times.push(sec);
    console.log(`Run ${i + 1}/${runs}: embed took ${sec.toFixed(2)}s`);
  }

  if (verify) {
    console.log("\nVerifying embedding...");
    verifyEmbedding();
    console.log("✓ Search returned relevant results");
  }

  if (runs > 1) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`\nStats: avg=${avg.toFixed(2)}s min=${min.toFixed(2)}s max=${max.toFixed(2)}s`);
  }

  // Second run (no teardown) - measures "already embedded" path
  if (!teardownFirst && runs === 1) {
    console.log("\nRunning embed again (should skip - nothing to do)...");
    const skipSec = timeEmbed();
    console.log(`Skip path: ${skipSec.toFixed(2)}s`);
  }
}

main();
