/**
 * CLI helpers: info, commandOutput, parseFlag, consumeBooleanFlag, ensureHelpNotRequested.
 */
import { readFileSync } from "node:fs";
import { EXIT, fail } from "./errors.ts";

export function info(message: string): void {
  console.error(`gl: ${message}`);
}

export function commandOutput(
  data: unknown,
  asJson: boolean = false
): void {
  if (asJson) {
    Deno.stdout.writeSync(new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`));
    return;
  }
  if (typeof data === "string") {
    Deno.stdout.writeSync(new TextEncoder().encode(`${data}\n`));
    return;
  }
  Deno.stdout.writeSync(new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`));
}

export interface ParseFlagResult {
  found: boolean;
  value: string | null;
  args: string[];
}

export function parseFlag(
  args: string[],
  longName: string,
  shortName: string | null = null
): ParseFlagResult {
  const idxLong = args.indexOf(longName);
  const idxShort = shortName ? args.indexOf(shortName) : -1;
  const idx = idxLong >= 0 ? idxLong : idxShort;
  if (idx < 0) return { found: false, value: null, args };
  if (idx + 1 >= args.length || args[idx + 1].startsWith("-")) {
    fail(`missing value for ${longName}`, EXIT.USER);
  }
  const value = args[idx + 1];
  const next = args.slice(0, idx).concat(args.slice(idx + 2));
  return { found: true, value, args: next };
}

export interface ConsumeBooleanFlagResult {
  found: boolean;
  args: string[];
}

export function consumeBooleanFlag(
  args: string[],
  longName: string
): ConsumeBooleanFlagResult {
  const idx = args.indexOf(longName);
  if (idx < 0) return { found: false, args };
  return { found: true, args: args.slice(0, idx).concat(args.slice(idx + 1)) };
}

export function ensureHelpNotRequested(args: string[], text: string): void {
  if (args.includes("--help") || args.includes("-h")) {
    commandOutput(text);
    Deno.exit(EXIT.OK);
  }
}

export function readStdinOrFail(): string {
  const text = readFileSync(0, "utf8");
  if (!text || !text.trim()) fail("stdin content is required", EXIT.USER);
  return text;
}

const MAIN_HELP = [
  "gl - giterloper CLI (main commands)",
  "",
  "Usage:",
  "  gl <command> [subcommand] [options]",
  "",
  "Commands:",
  "  diagnostic [--pin <name>]       Health check: pins, clones, collections, vectors",
  "  add [--pin <name>] [--name]    Queue content (stdin)",
  "  subtract [--pin <name>] [--name]  Queue subtraction (stdin)",
  "  reconcile [--pin <name>]       Process queues into knowledge/",
  "  promote [--pin <name>]          Finalize staged changes to remote",
  "  merge <source> <target>        Merge source pin branch into target",
  "  search <query> [--pin <name>]   Keyword search",
  "  query <question> [--pin <name>] Question answering",
  "  get <path> [--pin <name>]      Retrieve document",
  "  pin list|add|remove|update      Pin management",
  "  gpu [--cpu]                    GPU/CPU detection",
  "",
  'Run "gl <command> --help" for command-specific usage.',
].join("\n");

const EXTENDED_HELP = [
  "gl extended - debugging and low-level commands",
  "",
  "Usage:",
  "  gl extended <command> [options]",
  "",
  "Commands:",
  "  status [--json]                Raw pin/clone/collection state",
  "  clone [--pin <name>|--all]     Manual clone (normally auto via pin add/update)",
  "  index [--pin <name>|--all]     Manual index (normally auto)",
  "  teardown <name>                Same as pin remove",
  "  stage [branch] [--pin <name>]  Manual staged clone (normally auto)",
  "  stage-cleanup [branch]         Discard staged clone without promoting",
  "  verify [--pin <name>]          Detailed verification",
  "",
  'Run "gl extended <command> --help" for command-specific usage.',
].join("\n");

export function printTopHelp(): void {
  commandOutput(MAIN_HELP);
}

export function printExtendedHelp(): void {
  commandOutput(EXTENDED_HELP);
}
