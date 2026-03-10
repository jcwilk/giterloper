#!/usr/bin/env -S deno run -A
/**
 * gl-extended - debugging and under-the-hood commands.
 * Invoke with: deno run -A lib/gl-extended.ts [command] [args]
 * Not exposed to agents via the gl skill. Use for debugging/maintenance only.
 */
import { EXIT, GlError, fail } from "./errors.ts";
import { consumeBooleanFlag, printExtendedHelp } from "./cli.ts";
import {
  cmdStatus,
  cmdVerify,
  cmdGpu,
  cmdClone,
  cmdIndex,
  cmdTeardown,
  cmdStage,
  cmdStageCleanup,
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
  if (cmd === "clone") return cmdClone(state, rest);
  if (cmd === "index") return cmdIndex(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);

  fail(`unknown command "${cmd}". Run "deno run -A lib/gl-extended.ts --help".`, EXIT.USER);
}

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
