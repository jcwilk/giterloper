#!/usr/bin/env -S deno run -A
/**
 * Collects logical Deno.test case names from under tests/ (glob: *.test.ts) and writes tests/test-case-manifest.json.
 * Run after adding/renaming tests. Used by scripts/run-tests.ts for per-case subprocess scheduling.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function* walkTestFiles(dir: string): AsyncGenerator<string> {
  for await (const e of Deno.readDir(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      yield* walkTestFiles(p);
    } else if (e.isFile && e.name.endsWith(".test.ts")) {
      yield p;
    }
  }
}

/** `Deno.test("...` on the same line as the opening paren */
const INLINE_NAME = /Deno\.test\s*\(\s*"((?:[^"\\]|\\.)*)"/g;
/** `Deno.test(` then newline then `"..."` */
const MULTILINE_NAME = /Deno\.test\s*\(\s*\r?\n\s*"((?:[^"\\]|\\.)*)"/g;

function unescapeJsStringInner(inner: string): string {
  return inner.replace(/\\(.)/g, (_, c: string) => {
    if (c === "n") return "\n";
    if (c === "t") return "\t";
    if (c === "r") return "\r";
    return c;
  });
}

function collectNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const re of [INLINE_NAME, MULTILINE_NAME]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      names.add(unescapeJsStringInner(m[1]));
    }
  }
  return names;
}

const cases: { path: string; name: string }[] = [];

for await (const abs of walkTestFiles(path.join(root, "tests"))) {
  const rel = path.relative(root, abs).split(path.sep).join("/");
  const text = await Deno.readTextFile(abs);
  for (const name of collectNames(text)) {
    cases.push({ path: rel, name });
  }
}

cases.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));

const out = path.join(root, "tests", "test-case-manifest.json");
await Deno.writeTextFile(out, JSON.stringify({ cases }, null, 2) + "\n");
console.log(`Wrote ${cases.length} cases to ${path.relative(root, out)}`);
