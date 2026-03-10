#!/usr/bin/env -S deno run -A
/**
 * gl-extended - giterloper extended CLI for debugging/maintenance.
 * Invoke with: deno run -A lib/gl-extended.ts <command> [args]
 *
 * Not exposed in the gl skill. Use for debugging, testing, or maintenance only.
 */
import { consumeBooleanFlag, printExtendedHelp } from "./cli.ts";
import { EXIT, GlError, fail } from "./errors.ts";
import {
  cmdClone,
  cmdGpu,
  cmdIndex,
  cmdPinRemove,
  cmdStage,
  cmdStageCleanup,
  cmdStatus,
  cmdTeardown,
  cmdVerify,
  makeState,
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
  if (cmd === "pin") {
    if (rest.length === 0) fail("usage: gl-extended pin remove <name>", EXIT.USER);
    const [sub, ...subArgs] = rest;
    if (sub === "remove") return cmdPinRemove(state, subArgs);
    fail(`unknown pin subcommand "${sub}". Run "gl-extended --help".`, EXIT.USER);
  }
  if (cmd === "clone") return cmdClone(state, rest);
  if (cmd === "index") return cmdIndex(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);

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
    console.error(`gl-extended: unexpected error: ${e?.message ?? e}`);
    Deno.exit(EXIT.EXTERNAL);
  }
}
