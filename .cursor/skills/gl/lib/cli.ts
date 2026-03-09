/**
 * CLI helpers: info, commandOutput, parseFlag, consumeBooleanFlag, ensureHelpNotRequested.
 */
import { EXIT, fail } from "./errors.js";

export function info(message: string): void {
  console.error(`gl: ${message}`);
}

export function commandOutput(
  data: unknown,
  asJson: boolean = false
): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  if (typeof data === "string") {
    process.stdout.write(`${data}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
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
    process.exit(EXIT.OK);
  }
}
