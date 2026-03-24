#!/usr/bin/env -S deno run -A
/**
 * Topic / bypass `deno test` wrapper: allocates a per-invocation directory under
 * `tests/roots/giterloper-test-runs/` (same allocator as the unified harness) and sets
 * `GITERLOPER_MCP_TEST_SESSION_PARENT` for the child `deno` process.
 *
 * Usage (repo root):
 * ```sh
 * deno run -A scripts/deno-test-topic.ts -- test -A tests/cli/
 * ```
 * With memsearch on PATH (or via `with-memsearch`):
 * ```sh
 * deno run -A scripts/with-memsearch.ts -- run -A scripts/deno-test-topic.ts -- test -A tests/pin-semantics/
 * ```
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GITERLOPER_MCP_TEST_SESSION_PARENT } from "../lib/session-layout.ts";
import { allocateTestRunRoot } from "./test-run-roots.ts";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let denoArgs = Deno.args;
if (denoArgs[0] === "--") denoArgs = denoArgs.slice(1);

if (denoArgs.length === 0) {
  console.error(
    "usage: deno run -A scripts/deno-test-topic.ts -- <deno test args...>\n" +
      "example: deno run -A scripts/deno-test-topic.ts -- test -A tests/cli/",
  );
  Deno.exit(1);
}

const { absoluteParent } = await allocateTestRunRoot(REPO_ROOT);
const env = {
  ...Deno.env.toObject(),
  [GITERLOPER_MCP_TEST_SESSION_PARENT]: absoluteParent,
};

const { code } = await new Deno.Command(Deno.execPath(), {
  args: denoArgs,
  cwd: REPO_ROOT,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env,
}).output();

Deno.exit(code);
