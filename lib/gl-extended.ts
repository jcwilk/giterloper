#!/usr/bin/env -S deno run -A
/**
 * gl extended - giterloper extended CLI for debugging and maintenance.
 * Run with: deno run -A lib/gl-extended.ts <command> [args]
 * Or: ./scripts/gl-extended <command>
 *
 * Not exposed to the gl skill. For agents: prefer gl (main) commands; use
 * gl-extended only when debugging or performing low-level maintenance.
 */
import { EXIT, GlError, fail } from "./errors.ts";
import {
  consumeBooleanFlag,
  printExtendedHelp,
} from "./cli.ts";
import {
  makeState,
  cmdStatus,
  cmdVerify,
  cmdGpu,
  cmdClone,
  cmdIndex,
  cmdTeardown,
  cmdStage,
  cmdStageCleanup,
  cmdPromote,
  cmdQmdOrphanCleanup,
} from "./gl.ts";

async function main() {
  let args = [...Deno.args];
  const helpJsonParsed = consumeBooleanFlag(args, "--json");
  args = helpJsonParsed.args;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printExtendedHelp();
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
  if (cmd === "promote") return cmdPromote(state, rest);
  if (cmd === "qmd-orphan-cleanup") return cmdQmdOrphanCleanup(state, rest);

  fail(`unknown command "${cmd}". Run "gl-extended --help".`, EXIT.USER);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    if (e instanceof GlError) {
      console.error(`gl-extended: ${e.message}`);
      Deno.exit(e.code);
    }
    console.error(`gl-extended: unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    Deno.exit(EXIT.EXTERNAL);
  }
}
