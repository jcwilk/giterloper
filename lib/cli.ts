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

const TOP_HELP = [
  "gl - giterloper CLI",
  "",
  "Usage:",
  "  gl <command> [subcommand] [options]",
  "",
  "Commands:",
  "  diagnostic [--pin <name>] [--json]",
  "  pin list|add|remove|update|load [--pin <name>]",
  "  insert [--pin <name>] [--name <name>]",
  "  install-remote <pin>",
  "  merge <source-pin> <target-pin>",
  "",
  'Run "gl <command> --help" for command-specific usage.',
].join("\n");

const MAINTENANCE_HELP = [
  "gl maintenance - giterloper CLI (maintenance commands only)",
  "",
  "Usage:",
  "  gl-maintenance <command> [subcommand] [options]",
  "",
  "Commands:",
  "  status [--json]",
  "  verify [--pin <name>] [--json]",
  "  clone [--pin <name> | --all]",
  "  teardown <name>",
  "  stage [branch] [--pin <name>]",
  "  stage-cleanup [branch] [--pin <name>]",
  "  promote [--pin <name>]",
  "",
  "Invoke: ./scripts/gl-maintenance <command> or deno run -A lib/gl-maintenance.ts <command>",
  "",
  'Run "gl-maintenance <command> --help" for command-specific usage.',
].join("\n");

export function printTopHelp(): void {
  commandOutput(TOP_HELP);
}

export function printMaintenanceHelp(): void {
  commandOutput(MAINTENANCE_HELP);
}
