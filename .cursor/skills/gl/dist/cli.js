/**
 * CLI helpers: info, commandOutput, parseFlag, consumeBooleanFlag, ensureHelpNotRequested.
 */
import { EXIT, fail } from "./errors.js";
export function info(message) {
    console.error(`gl: ${message}`);
}
export function commandOutput(data, asJson = false) {
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
export function parseFlag(args, longName, shortName = null) {
    const idxLong = args.indexOf(longName);
    const idxShort = shortName ? args.indexOf(shortName) : -1;
    const idx = idxLong >= 0 ? idxLong : idxShort;
    if (idx < 0)
        return { found: false, value: null, args };
    if (idx + 1 >= args.length || args[idx + 1].startsWith("-")) {
        fail(`missing value for ${longName}`, EXIT.USER);
    }
    const value = args[idx + 1];
    const next = args.slice(0, idx).concat(args.slice(idx + 2));
    return { found: true, value, args: next };
}
export function consumeBooleanFlag(args, longName) {
    const idx = args.indexOf(longName);
    if (idx < 0)
        return { found: false, args };
    return { found: true, args: args.slice(0, idx).concat(args.slice(idx + 1)) };
}
export function ensureHelpNotRequested(args, text) {
    if (args.includes("--help") || args.includes("-h")) {
        commandOutput(text);
        process.exit(EXIT.OK);
    }
}
