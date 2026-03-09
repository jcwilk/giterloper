#!/usr/bin/env node
/**
 * Reproducible benchmark for qmd embed performance.
 *
 * Usage:
 *   node scripts/benchmark-embed.mjs [--reset] [--runs N]
 *   npm run benchmark:embed [-- --reset] [--runs N]
 *
 * --reset: Clear vectors and force full re-embed before timing.
 * --runs N: Number of timed runs (default: 2).
 *
 * Requires: gl clone and gl index to have been run at least once (creates collection).
 * To force re-embed from scratch: rm .giterloper/qmd/cache/qmd/<index>.sqlite then run gl index.
 *
 * Verification: Final vector count and vsearch results confirm embedding took effect.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function runGl(args, opts = {}) {
  const result = spawnSync(
    "node",
    [path.join(ROOT, ".cursor/skills/gl/scripts/gl.mjs"), ...args],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GITERLOPER_BENCHMARK: "1" },
      ...opts,
    }
  );
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status,
  };
}

function runQmd(indexArgs, opts = {}) {
  const result = spawnSync("qmd", indexArgs, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      XDG_CONFIG_HOME: path.join(ROOT, ".giterloper/qmd/config"),
      XDG_CACHE_HOME: path.join(ROOT, ".giterloper/qmd/cache"),
      NODE_LLAMA_CPP_GPU: "false",
    },
    ...opts,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status,
  };
}

function getPin() {
  const pinnedPath = path.join(ROOT, ".giterloper/pinned.yaml");
  if (!existsSync(pinnedPath)) return null;
  const content = readFileSync(pinnedPath, "utf8");
  const lines = content.split("\n");
  let name = null,
    sha = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("repo:")) continue;
    const nameMatch = trimmed.match(/^(\w+):\s*$/);
    if (nameMatch) name = nameMatch[1];
    if (trimmed.startsWith("sha:")) sha = trimmed.split(":")[1].trim();
  }
  if (name && sha) return { name, sha };
  return null;
}

function getVectorCount(pin) {
  if (!pin) return null;
  const indexName = `${pin.name}_${pin.sha}`;
  const dbPath = path.join(ROOT, ".giterloper/qmd/cache/qmd", `${indexName}.sqlite`);
  if (!existsSync(dbPath)) return null;
  const r = spawnSync("sqlite3", [dbPath, "SELECT COUNT(*) FROM content_vectors"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) return null;
  const n = parseInt((r.stdout || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function runTimedEmbed(pin) {
  if (!pin) return null;
  const indexName = `${pin.name}_${pin.sha}`;
  const start = performance.now();
  const r = runQmd(["--index", indexName, "embed"]);
  const elapsed = performance.now() - start;
  return { ok: r.ok, elapsed, stdout: r.stdout, stderr: r.stderr };
}

function runVsearchVerify(pin) {
  if (!pin) return null;
  const indexName = `${pin.name}_${pin.sha}`;
  const collection = `${pin.name}@${pin.sha}`;
  const r = runQmd([
    "--index",
    indexName,
    "vsearch",
    "giterloper knowledge store",
    "-c",
    collection,
    "-n",
    "3",
    "--json",
  ]);
  if (!r.ok) return { ok: false };
  try {
    const data = JSON.parse(r.stdout);
    const hits = Array.isArray(data) ? data : data?.results ?? data;
    return { ok: true, hitCount: hits?.length ?? 0, sample: hits?.[0] };
  } catch {
    return { ok: false };
  }
}

function main() {
  const args = process.argv.slice(2);
  const doReset = args.includes("--reset");
  const runsIdx = args.indexOf("--runs");
  const runs = runsIdx >= 0 ? parseInt(args[runsIdx + 1], 10) || 2 : 2;

  const pin = getPin();
  if (!pin) {
    console.error("No pin found in .giterloper/pinned.yaml. Run 'gl clone' and 'gl index' first.");
    process.exit(1);
  }

  const versionsDir = path.join(ROOT, ".giterloper/versions", pin.name, pin.sha);
  if (!existsSync(versionsDir)) {
    console.error("Clone missing. Run 'gl clone' first.");
    process.exit(1);
  }

  console.log("Benchmark: qmd embed");
  console.log(`Pin: ${pin.name}@${pin.sha}`);
  console.log("");

  let vectorCount = getVectorCount(pin);
  console.log(`Initial vector count: ${vectorCount ?? "unknown"}`);

  if (doReset && vectorCount !== null && vectorCount > 0) {
    console.log("Resetting vectors (qmd embed -f)...");
    runQmd(["--index", `${pin.name}_${pin.sha}`, "embed", "-f"]);
    vectorCount = getVectorCount(pin);
    console.log(`After reset: ${vectorCount} vectors (will re-embed on next run)`);
  }
  console.log("");

  const timings = [];
  for (let i = 0; i < runs; i++) {
    const result = runTimedEmbed(pin);
    if (!result) continue;
    timings.push(result.elapsed);
    const status = result.stdout.includes("already have embeddings")
      ? " (skip - already embedded)"
      : "";
    console.log(`Run ${i + 1}: ${(result.elapsed / 1000).toFixed(2)}s${status}`);
  }

  if (timings.length > 0) {
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);
    console.log("");
    console.log(`Summary: avg=${(avg / 1000).toFixed(2)}s min=${(min / 1000).toFixed(2)}s max=${(max / 1000).toFixed(2)}s`);
  }

  vectorCount = getVectorCount(pin);
  console.log(`Final vector count: ${vectorCount ?? "unknown"}`);

  const verify = runVsearchVerify(pin);
  if (verify?.ok) {
    console.log(`Verification (vsearch): ${verify.hitCount} results`);
  }
}

main();
