# Testing Guide

This document is the canonical reference for test strategy, test execution, and E2E safety constraints.

## Why Tests Matter Here

This project relies on agentic coding workflows. A thoughtfully designed, rigorous test suite is essential because it is the most reliable way to confirm behavior matches intent.

E2E tests are especially valuable as executable workflow documentation: they show what "correct" user-visible behavior looks like in an unambiguous way that both humans and agents can follow.

## E2E Scope: Less Is More

- Keep E2E coverage focused on core workflows and contract boundaries.
- Avoid overlapping scenarios that assert the same behavior in multiple places.
- Prefer a smaller, high-signal E2E suite over a large redundant suite.
- Use unit tests for combinatorial edge cases and implementation-level details.

## Run Environment

Use native Deno for development and tests.

### Running all checks

From the repository root, run every check (typecheck, unit tests, E2E tests) in the canonical order; the script exits on first failure:

```bash
./scripts/check_all.sh
```

Or via Deno: `deno task check`

Use this before persisting ticket work (e.g. verifier and work-next run it to validate changes).

### Individual commands

- **Typecheck:** `deno check lib/gl.ts` — required when touching TypeScript; run with test changes.
- **Unit tests:** `deno test -A tests/unit/`
- **E2E tests:** `deno run -A scripts/run-e2e.ts`

## E2E Tests: Collision Avoidance (CRITICAL)

E2E tests use a shared remote repository (`giterloper_test_knowledge`) and shared local state (`.giterloper/`, `pinned.yaml`). Avoid collisions using the rules below.

### 1) Randomize all collision-prone names

Each test file should generate a unique `RUN_ID` at load time:

```js
const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;
```

(`E2E_MARKER` is `"gle2e_"` from `tests/e2e/config.ts`. The runner's safety net removes pins whose names include this marker after tests finish.)

Every collision-prone name must include `RUN_ID` (or equivalent entropy):

| Resource | Pattern | Why |
|----------|---------|-----|
| Pin names | `test_knowledge_${RUN_ID}` | `.giterloper/versions/<name>/`, `pinned.yaml` |
| Branches (remote) | `${RUN_ID}` or `${RUN_ID}_suffix` | Shared remote; cleanup only deletes our branch |
| Scratch pins | `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}` | Parallel tests; `Date.now()` alone can collide |
| File paths in remote | `knowledge/e2e_${RUN_ID}_${randomBytes(4)}.md` | Avoid overwrites between runs |

Assume tests can run in parallel within a file. Use `crypto.randomBytes` for entropy; `Date.now()` is insufficient.

### 2) Test independence (CRITICAL)

Every test must be self-contained. No test may depend on another test's side effects.

- Tests that write should create their own scratch pins with unique branches.
- Do not use `concurrency: 1` or shared mutable state between tests.

### 3) Shared state notes (`pinned.yaml`)

- `.giterloper/pinned.yaml` is read/written by multiple test files.
- With unique pin names, tests do not collide.
- Writes are protected by a FIFO mutex at `.giterloper/locks/pins/`.
- `.giterloper/versions/` and `staged/` are keyed by pin name, so unique names isolate runs.

### 4) Cleanup and branch isolation

`cleanupTestKnowledgeRepo(source, sha, { pinName, branchName })` supports:

- Legacy (`pinName` string): deletes all remote branches except `main`; use only when no concurrent run can exist.
- Parallel-safe (`{ pinName, branchName }` object): deletes only this run's branch, force-pushes `main`, recreates this run's branch from `main`.

### 5) Pin lifecycle and cloning

`updatePinSha()` and `cmdPinAdd` manage clones:

- when a pin name+SHA is written, clone is created;
- when SHA changes, prior clone is torn down.

`insert`, `merge`, `promote`, and `pin update` all flow through this lifecycle.

- Use `gl pin load` to ensure pins are cloned without adding.
- Use `gl-maintenance clone` only for low-level debugging/maintenance.

## Auth and Remote Access for E2E

E2E tests require push access to `github.com/jcwilk/giterloper_test_knowledge`.

- In Cursor Cloud, assume `GITERLOPER_GH_TOKEN` is set.
- Locally, use `GITERLOPER_GH_TOKEN` or authenticate with `gh auth login`.
