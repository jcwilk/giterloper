---
id: git-k9pg
status: open
deps: []
links: []
created: 2026-03-22T18:53:00Z
type: task
priority: 1
assignee: user.email
parent: git-snjk
---
# AST fail-closed test discovery module

Add scripts/discover-test-cases.ts per .cursor/plans/dynamic_runner_hardened_10c3029f.plan.md §1. Walk tests/**/*.test.ts (skip node_modules, dot-dirs) like scripts/build-test-case-manifest.ts. Use a pinned TypeScript AST parser (e.g. SWC), not regex as primary. Extract static Deno.test names from string first arg or object literal name property.

## Design

Export a stable API for `git-od4q`, e.g. `export async function discoverTestCases(repoRoot: string): Promise<{ path: string; name: string }[]>` — throw or `Deno.exit(1)` on hard errors (same categories below). Invocable as `deno run -A scripts/discover-test-cases.ts` from repo root optional for debugging.

Pin parser in root `deno.json` `imports` and **refresh root `deno.lock`** when adding the dependency.

**Header comment** in `discover-test-cases.ts` documents fail-closed rules and unsupported patterns (pair with `tests/README.md`).

Hard errors before any workers: (1) any `Deno.test(...)` where a **static** test name cannot be **resolved** (template literals, computed `name`, spread, etc.) — report file path (+ line/col if available); (2) any `*.test.ts` with zero discovered cases; (3) **duplicate logical test name strings within the same file** (anchored `--filter` cannot target one case). Do NOT add a separate discover unit test file (explicitly out of scope).

**Docs split:** Add a `tests/README.md` subsection for AST discovery limits / unsupported registrations; full runner rewrite (manifest removal, JUnit, stderr case count) lands in `git-od4q` / `git-i3e8` — short-term overlap with old manifest wording is OK until those close.

## Acceptance Criteria

- `scripts/discover-test-cases.ts` exists with exported `discoverTestCases` (or equivalent name agreed in PR) returning `{ path, name }[]` (ordering defined by `git-od4q`); `git-od4q` imports it.
- Root `deno.json` lists the parser; root `deno.lock` updated.
- Module documents violation categories (README subsection + script header).
- No `tests/discover-*.test.ts` (or similar) added.

