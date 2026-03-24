/**
 * Low-cost guardrail (git-n14t): the unified harness must schedule one subprocess per logical
 * `(path, name)` from discovery, not one per file. If every module had at most one case, this
 * invariant would fail — catch accidental regression toward file-level scheduling.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverTestCases } from "../../scripts/discover-test-cases.ts";

Deno.test("discoverTestCases yields multiple cases for at least one file (per-case harness scheduling)", async () => {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const cases = await discoverTestCases(repoRoot);
  const countByPath = new Map<string, number>();
  for (const c of cases) {
    countByPath.set(c.path, (countByPath.get(c.path) ?? 0) + 1);
  }
  let maxPerFile = 0;
  for (const n of countByPath.values()) {
    maxPerFile = Math.max(maxPerFile, n);
  }
  if (maxPerFile < 2) {
    throw new Error(
      "expected at least one tests/**/*.test.ts with multiple static Deno.test cases (harness is per-case, not per-file)",
    );
  }
});
