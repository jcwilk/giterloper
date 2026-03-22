---
id: git-od4q
status: closed
deps: [git-k9pg]
links: []
created: 2026-03-22T18:53:03Z
type: task
priority: 1
assignee: user.email
parent: git-snjk
---
# Harness: wire discovery, JUnit >=1 test ran, remove manifest

Refactor scripts/run-tests.ts per plan §2–3: import primary export from `./discover-test-cases.ts` (contract per **git-k9pg**), sort by path then name, mandatory **stderr** line with total discovered case count, remove manifest read. Delete `tests/test-case-manifest.json`, `scripts/build-test-case-manifest.ts`, and `deno.json` `gen:test-manifest` task.

## Design

runOne: run `deno test` with `--filter /^name$/` as today; use machine-readable JUnit output per **current** `deno test --help` (e.g. `--reporter junit --junit-path <tempfile>`, or Deno-documented equivalent); parse XML to require **>=1 testcase executed** and **zero failures/errors**; on violation print `(path, name)` and return non-zero. **Do not** treat Deno exit code alone as success (Deno 2.7 exits 0 when all tests are filtered out). Update `run-tests.ts` header comments (no manifest / `gen:test-manifest`).

If aggregate discovered case list is **empty** after discovery, exit non-zero with a clear message (mirror prior empty-manifest behavior).

Contributor docs (`AGENTS.md`, full `tests/README.md` harness section) may still mention the manifest until **git-i3e8**; this ticket owns code truth.

## Acceptance Criteria

- `./scripts/check_all.sh` passes.
- No `tests/test-case-manifest.json`; no `gen:test-manifest` in `deno.json`; `scripts/build-test-case-manifest.ts` removed.
- Harness exits non-zero on discovery hard errors; exits non-zero if **zero cases** total after discovery.
- Per-case subprocess fails non-zero when the filter would run **0** tests (document a one-line repro in PR description or ticket note for verifier).
- Stderr logs total discovered case count at suite start.

