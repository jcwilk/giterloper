#!/usr/bin/env -S deno run -A
/**
 * Full repo checks: typecheck + unified test harness (see tests/README.md).
 * Ensures memsearch on PATH before tests (repo .venv bootstrap if needed).
 */
import { ensureMemsearchOnPath, REPO_ROOT } from "./bootstrap-memsearch.ts";

async function run(args: string[], label: string): Promise<number> {
  console.log(`==> ${label}`);
  const r = await new Deno.Command(args[0]!, {
    args: args.slice(1),
    cwd: REPO_ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: Deno.env.toObject(),
  }).output();
  return r.code;
}

await ensureMemsearchOnPath();

let code = await run(["deno", "check", "lib/gl.ts"], "Typecheck (deno check lib/gl.ts)");
if (code !== 0) Deno.exit(code);

code = await run(
  ["deno", "run", "-A", "scripts/run-tests.ts"],
  "Tests (deno run -A scripts/run-tests.ts — see tests/README.md for harness / parallelism)",
);
if (code !== 0) Deno.exit(code);

console.log("==> All checks passed");
