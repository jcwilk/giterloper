#!/usr/bin/env -S deno run -A
/**
 * AST-based discovery of static `Deno.test(...)` registrations under the `tests/` tree (recursive),
 * files ending in `.test.ts` (same coverage as the manifest glob used by `build-test-case-manifest.ts`).
 *
 * ## Fail-closed rules (harness exits non-zero before workers if any apply)
 *
 * 1. **Unresolvable test name** — A call to `Deno.test` where the logical name is not a static
 *    string: first argument must be either a string literal or an object literal containing a
 *    static `name` property (identifier `name` or `"name"` key) whose value is a string literal.
 *    Template literals, computed keys, non-literal `name`, dynamic first arguments, or **spread
 *    (`...`) in the call argument list** are rejected. Reports file path and line/column from the
 *    parser span when available.
 * 2. **Empty test file** — Any scanned `*.test.ts` with zero discovered cases.
 * 3. **Duplicate names in one file** — Two or more registrations with the same resolved name in
 *    the same file (anchored `--filter` cannot target a single case).
 *
 * ## Unsupported / non-discoverable (do not use in `tests/` `.test.ts` files)
 *
 * See **tests/README.md** (AST discovery). Patterns include: `Deno.test` via alias or variable,
 * dynamic names, `Deno.test(...spread)`, object registration without a static string `name`, and
 * computed or template `name` properties.
 *
 * Walk rules match `scripts/build-test-case-manifest.ts`: recurse under `tests/`, skip
 * `node_modules` and dot-directories.
 */
import * as swc from "@swc/wasm";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface DiscoveredTestCase {
  path: string;
  name: string;
}

interface SwcSpan {
  start: number;
  end: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

function positionFromSpan(source: string, span: SwcSpan | undefined): { line: number; col: number } {
  // SWC spans use 1-based byte offsets; JavaScript string indices are 0-based.
  const offset = span ? Math.max(0, span.start - 1) : 0;
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    const ch = source[i];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function formatWhere(filePath: string, source: string, span: SwcSpan | undefined): string {
  const { line, col } = positionFromSpan(source, span);
  return span ? `${filePath}:${line}:${col}` : filePath;
}

function isDenoTestCallee(callee: unknown): boolean {
  if (!isRecord(callee) || callee.type !== "MemberExpression") return false;
  if (callee.computed === true) return false;
  const obj = callee.object;
  const prop = callee.property;
  if (!isRecord(obj) || obj.type !== "Identifier" || obj.value !== "Deno") return false;
  if (!isRecord(prop) || prop.type !== "Identifier" || prop.value !== "test") return false;
  return true;
}

function staticNameFromObjectExpr(expr: Record<string, unknown>, filePath: string, source: string): string | null {
  if (expr.type !== "ObjectExpression" || !Array.isArray(expr.properties)) return null;
  for (const prop of expr.properties) {
    if (!isRecord(prop)) continue;
    if (prop.type === "SpreadElement") continue;
    if (prop.type !== "KeyValueProperty") continue;
    const key = prop.key;
    const val = prop.value;
    if (!isRecord(key) || !isRecord(val)) continue;
    const keyOk =
      (key.type === "Identifier" && key.value === "name") ||
      (key.type === "StringLiteral" && key.value === "name");
    if (!keyOk) continue;
    if (val.type === "StringLiteral" && typeof val.value === "string") return val.value;
    return "__invalid__";
  }
  return null;
}

function resolveTestName(
  call: Record<string, unknown>,
  filePath: string,
  source: string,
): { name: string; span: SwcSpan | undefined } {
  const args = call.arguments;
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error(
      `${formatWhere(filePath, source, (call.span as SwcSpan | undefined))}: Deno.test() has no arguments`,
    );
  }
  for (const arg of args) {
    if (!isRecord(arg)) continue;
    if (arg.spread != null) {
      throw new Error(
        `${formatWhere(filePath, source, (call.span as SwcSpan | undefined))}: Deno.test(...) uses spread in arguments; static name required`,
      );
    }
  }
  const first = args[0];
  if (!isRecord(first) || !isRecord(first.expression)) {
    throw new Error(`${formatWhere(filePath, source, (call.span as SwcSpan | undefined))}: Deno.test: invalid first argument`);
  }
  const e = first.expression as Record<string, unknown>;
  const callSpan = call.span as SwcSpan | undefined;

  if (e.type === "StringLiteral" && typeof e.value === "string") {
    return { name: e.value, span: e.span as SwcSpan | undefined };
  }
  if (e.type === "ObjectExpression") {
    const n = staticNameFromObjectExpr(e, filePath, source);
    if (n === "__invalid__") {
      throw new Error(
        `${formatWhere(filePath, source, (e.span as SwcSpan | undefined) ?? callSpan)}: Deno.test options object has non-static string "name"`,
      );
    }
    if (n !== null) return { name: n, span: (e.span as SwcSpan | undefined) ?? callSpan };
    throw new Error(
      `${formatWhere(filePath, source, (e.span as SwcSpan | undefined) ?? callSpan)}: Deno.test options object has no static string "name" property`,
    );
  }
  throw new Error(
    `${formatWhere(filePath, source, (e.span as SwcSpan | undefined) ?? callSpan)}: Deno.test first argument is not a static string or options object with static name`,
  );
}

function visitCallExpressions(node: unknown, out: Record<string, unknown>[]): void {
  if (!isRecord(node)) return;
  if (node.type === "CallExpression") out.push(node);
  for (const [k, v] of Object.entries(node)) {
    if (k === "span") continue;
    if (Array.isArray(v)) {
      for (const item of v) visitCallExpressions(item, out);
    } else if (v !== null && typeof v === "object") {
      visitCallExpressions(v, out);
    }
  }
}

async function* walkTestFiles(testsDir: string): AsyncGenerator<string> {
  for await (const e of Deno.readDir(testsDir)) {
    const p = path.join(testsDir, e.name);
    if (e.isDirectory) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      yield* walkTestFiles(p);
    } else if (e.isFile && e.name.endsWith(".test.ts")) {
      yield p;
    }
  }
}

/**
 * Discover logical `Deno.test` cases under `<repoRoot>/tests/` (recursive `*.test.ts` only).
 * Sort order: `path` (POSIX) ascending, then `name` ascending (stable for harness scheduling).
 */
export async function discoverTestCases(repoRoot: string): Promise<DiscoveredTestCase[]> {
  const testsDir = path.join(repoRoot, "tests");
  const cases: DiscoveredTestCase[] = [];

  for await (const abs of walkTestFiles(testsDir)) {
    const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
    const source = await Deno.readTextFile(abs);
    let module: Record<string, unknown>;
    try {
      module = swc.parseSync(source, {
        syntax: "typescript",
        tsx: false,
        decorators: false,
        dynamicImport: true,
      }) as unknown as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`${rel}: failed to parse: ${msg}`);
    }

    const calls: Record<string, unknown>[] = [];
    visitCallExpressions(module, calls);

    const namesInFile: string[] = [];
    for (const call of calls) {
      if (!isDenoTestCallee(call.callee)) continue;
      const { name } = resolveTestName(call, rel, source);
      namesInFile.push(name);
    }

    if (namesInFile.length === 0) {
      throw new Error(`${rel}: no static Deno.test cases discovered (fail-closed for empty *.test.ts)`);
    }
    const seen = new Set<string>();
    for (const n of namesInFile) {
      if (seen.has(n)) {
        throw new Error(`${rel}: duplicate static test name ${JSON.stringify(n)} (anchored --filter is ambiguous)`);
      }
      seen.add(n);
    }
    for (const name of namesInFile) {
      cases.push({ path: rel, name });
    }
  }

  cases.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));
  return cases;
}

if (import.meta.main) {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const discovered = await discoverTestCases(repoRoot);
    console.log(JSON.stringify({ cases: discovered }, null, 2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    Deno.exit(1);
  }
}
