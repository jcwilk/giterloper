#!/usr/bin/env -S deno run -A
/**
 * gl-extended - giterloper CLI with debugging/development commands.
 * Superset of gl; for development, testing, and going under the hood.
 */
import { EXIT, GlError, fail } from "./errors.ts";
import { consumeBooleanFlag } from "./cli.ts";

import {
  makeState,
  cmdStatus,
  cmdGpu,
  cmdPinList,
  cmdPinAdd,
  cmdPinRemove,
  cmdPinUpdate,
  cmdClone,
  cmdIndex,
  cmdTeardown,
  cmdSearchLike,
  cmdGet,
  cmdStage,
  cmdPromote,
  cmdStageCleanup,
  cmdVerify,
  cmdAddLike,
  cmdReconcile,
  cmdMerge,
  cmdDiagnostic,
} from "./gl.ts";
import { printTopHelpExtended } from "./cli.ts";

async function main() {
  let args = [...Deno.args];
  const helpJsonParsed = consumeBooleanFlag(args, "--json");
  args = helpJsonParsed.args;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printTopHelpExtended();
    return;
  }
  const state = makeState();
  state.globalJson = helpJsonParsed.found;

  const [cmd, ...rest] = args;

  if (cmd === "diagnostic") return cmdDiagnostic(state, rest);
  if (cmd === "status") return cmdStatus(state, rest);
  if (cmd === "verify") return cmdVerify(state, rest);
  if (cmd === "gpu") return cmdGpu(state, rest);
  if (cmd === "pin") {
    if (rest.length === 0) fail("usage: gl-extended pin <list|add|remove|update>", EXIT.USER);
    const [sub, ...subArgs] = rest;
    if (sub === "list") return cmdPinList(state, subArgs);
    if (sub === "add") return cmdPinAdd(state, subArgs);
    if (sub === "remove") return cmdPinRemove(state, subArgs);
    if (sub === "update") return cmdPinUpdate(state, subArgs);
    fail(`unknown pin subcommand "${sub}"`, EXIT.USER);
  }
  if (cmd === "clone") return cmdClone(state, rest);
  if (cmd === "index") return cmdIndex(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "search") return cmdSearchLike(state, "search", rest);
  if (cmd === "query") return cmdSearchLike(state, "query", rest);
  if (cmd === "get") return cmdGet(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "promote") return cmdPromote(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);
  if (cmd === "add") return cmdAddLike(state, rest, "add");
  if (cmd === "subtract") return cmdAddLike(state, rest, "subtract");
  if (cmd === "reconcile") return cmdReconcile(state, rest);
  if (cmd === "merge") return await cmdMerge(state, rest);

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
