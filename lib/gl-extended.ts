#!/usr/bin/env -S deno run -A
/**
 * gl extended - debugging and low-level giterloper operations.
 * Run with: deno run -A lib/gl-extended.ts <command> [args]
 *
 * Not exposed in the gl skill. Use for debugging/maintenance only.
 */
import {
  cmdClone,
  cmdGpu,
  cmdIndex,
  cmdStage,
  cmdStageCleanup,
  cmdStatus,
  cmdTeardown,
  cmdVerify,
  makeState,
} from "./gl.ts";
import { EXIT, GlError, fail } from "./errors.ts";
import { consumeBooleanFlag, printExtendedTopHelp } from "./cli.ts";

async function main() {
  let args = [...Deno.args];
  const helpJsonParsed = consumeBooleanFlag(args, "--json");
  args = helpJsonParsed.args;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printExtendedTopHelp();
    return;
  }
  const state = makeState();
  state.globalJson = helpJsonParsed.found;

  const [cmd, ...rest] = args;

  if (cmd === "status") return cmdStatus(state, rest);
  if (cmd === "verify") return cmdVerify(state, rest);
  if (cmd === "gpu") return cmdGpu(state, rest);
  if (cmd === "clone") return cmdClone(state, rest);
  if (cmd === "index") return cmdIndex(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);

  fail(`unknown extended command "${cmd}". Run "deno run -A lib/gl-extended.ts --help".`, EXIT.USER);
}

try {
  await main();
} catch (e) {
  if (e instanceof GlError) {
    console.error(`gl: ${e.message}`);
    Deno.exit(e.code);
  }
  console.error(`gl: unexpected error: ${(e as Error)?.message ?? e}`);
  Deno.exit(EXIT.EXTERNAL);
}
