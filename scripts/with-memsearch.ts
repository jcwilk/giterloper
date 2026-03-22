#!/usr/bin/env -S deno run -A
/**
 * Runs `deno` with child args after ensuring memsearch is on PATH (repo .venv if needed).
 * Used by deno.json MCP tasks and Cursor stdio launcher so agents need no manual venv step.
 */
import { ensureMemsearchOnPath, REPO_ROOT } from "./bootstrap-memsearch.ts";

await ensureMemsearchOnPath();

// `deno run wrapper.ts -- run -A ...` passes a leading `"--"` in Deno.args; strip it before exec.
let denoArgs = Deno.args;
if (denoArgs[0] === "--") denoArgs = denoArgs.slice(1);

if (denoArgs.length === 0) {
  console.error("usage: deno run -A scripts/with-memsearch.ts -- <deno subcommand and args...>");
  Deno.exit(1);
}

const { code } = await new Deno.Command(Deno.execPath(), {
  args: denoArgs,
  cwd: REPO_ROOT,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: Deno.env.toObject(),
}).output();

Deno.exit(code);
