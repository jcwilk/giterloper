#!/usr/bin/env -S deno run -A
/**
 * Thin wrapper: invokes lib/gl.ts from project root.
 * Run from workspace root: deno run -A lib/gl.ts [args]
 * Or: npm run gl [args]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const glScript = path.join(root, "lib", "gl.ts");

const proc = new Deno.Command("deno", {
  args: ["run", "-A", glScript, ...Deno.args],
  cwd: root,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const status = await proc.spawn().status;
Deno.exit(status.code);