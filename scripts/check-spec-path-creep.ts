#!/usr/bin/env -S deno run -A
/**
 * Fail if tracked files contain literal `specs/<basename>.md` path strings outside the
 * allowlist (AGENTS git-zug8 tier (a) hubs, verifier slice table, tests/README pairing,
 * specs cross-links + README hub, operational docs hub links, tickets).
 *
 * Does not match placeholders like `specs/<slice>.md` or bare `specs/*`.
 */
import { REPO_ROOT } from "./bootstrap-memsearch.ts";

const SPEC_MD_PATTERN = "specs/[a-zA-Z0-9_.-]+\\.md";

function allowlisted(relPath: string): boolean {
  if (
    relPath === "AGENTS.md" ||
    relPath === "HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md" ||
    relPath === "README.md" ||
    relPath === ".cursor/agents/verifier.md" ||
    relPath === ".cursor/agents/work-next.md" ||
    relPath === "tests/README.md"
  ) {
    return true;
  }
  if (relPath.startsWith("specs/")) return true;
  if (relPath.startsWith(".tickets/")) return true;
  if (relPath.startsWith("docs/")) return true;
  if (relPath.startsWith(".cursor/skills/file-tickets/")) return true;
  return false;
}

const r = await new Deno.Command("git", {
  args: ["grep", "-n", "-I", "-E", SPEC_MD_PATTERN],
  cwd: REPO_ROOT,
  stdout: "piped",
  stderr: "piped",
}).output();

if (r.code === 2) {
  const err = new TextDecoder().decode(r.stderr);
  console.error("check-spec-path-creep: git grep failed:\n", err);
  Deno.exit(2);
}

if (r.code === 1) {
  console.log("==> Spec path creep check: no literal specs/*.md strings in tracked files");
  Deno.exit(0);
}

const out = new TextDecoder().decode(r.stdout);
const violations: string[] = [];
for (const line of out.split("\n")) {
  if (!line) continue;
  const idx = line.indexOf(":");
  if (idx === -1) continue;
  const pathEnd = line.indexOf(":", idx + 1);
  if (pathEnd === -1) continue;
  const file = line.slice(0, idx);
  if (!allowlisted(file)) {
    violations.push(line);
  }
}

if (violations.length > 0) {
  console.error(
    "Spec path creep: literal specs/<file>.md outside allowlist. " +
      "Use slice labels or specs/<slice>.md-style placeholders per AGENTS / git-zug8 tier (c), " +
      "or add an intentional allowlist entry in scripts/check-spec-path-creep.ts.\n",
  );
  for (const v of violations) console.error(v);
  Deno.exit(1);
}

console.log("==> Spec path creep check: only allowlisted files reference concrete specs/*.md paths");
Deno.exit(0);
