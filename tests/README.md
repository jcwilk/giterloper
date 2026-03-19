# Testing Guide

This document is the canonical reference for test strategy, test execution, and integration-test safety constraints.

It is **not** the canonical source for product behavior semantics. Behavior semantics are defined by authoritative markdown specs (for example `docs/PIN_SETTING_PARAM_BEHAVIOR.md`). If tests conflict with those specs, update tests (and code) to match the authoritative markdown contract.

## Why Tests Matter Here

This project relies on agentic coding workflows. A thoughtfully designed, rigorous test suite is essential because it is the most reliable way to confirm behavior matches intent.

Tests under `tests/cli/` and `tests/mcp/` are especially valuable as executable workflow documentation: they show what correct user-visible behavior looks like in an unambiguous way that both humans and agents can follow.

## Integration scope: less is more

- Keep CLI and MCP workflow coverage focused on core paths and contract boundaries.
- Avoid overlapping scenarios that assert the same behavior in multiple places.
- Prefer a smaller, high-signal integration suite over a large redundant suite.
- Use `tests/core/` for combinatorial edge cases and implementation-level details.

## Run Environment

Use native Deno for development and tests.

### Running all checks

From the repository root, run every check (typecheck, then all topic test suites) in the canonical order; the script exits on first failure:

```bash
./scripts/check_all.sh
```

Or via Deno: `deno task check`

Use this before persisting ticket work (e.g. verifier and work-next run it to validate changes).

### Parallel execution

The unified runner and topic tasks use `deno test --parallel`, so **each test file** is a module that may run concurrently with others. Cap parallelism with the **`DENO_JOBS`** environment variable (integer); if unset, Deno defaults to the CPU count (`deno test --help`). Examples:

```bash
DENO_JOBS=4 ./scripts/check_all.sh
DENO_JOBS=8 deno task test:mcp
```

Tests inside a single file still run **one after another** (Deno’s runner does not run individual `Deno.test` cases in parallel in stable 2.x). Integration modules are written so **parallel files** stay isolated: distinct `sessionId` per CLI file, unique pin/branch names, and MCP tests that need a fresh app use `createMcpAppForTest()` instead of the singleton `mcpApp` where a second `initialize` would conflict. `runGl` / `runGlJson` and `runGlMaintenance` / `runGlMaintenanceJson` retry up to three times on transient `could not reach remote` failures (shared GitHub load under high `DENO_JOBS`).

### Layout and individual commands

Tests are grouped by **topic**, not by duration:

| Directory | Role |
|-----------|------|
| `tests/core/` | Fast, local library behavior (paths, pinned state, queues, etc.) |
| `tests/cli/` | `gl` / `gl-maintenance` workflows against a real remote |
| `tests/mcp/` | MCP server behavior, including HTTP client workflow tests |

- **Typecheck:** `deno check lib/gl.ts` — required when touching TypeScript; run with test changes.
- **Full test suite (CI-equivalent):** `deno run -A scripts/run-tests.ts` — runs `tests/core/`, `tests/cli/`, and `tests/mcp/` in one invocation with **`--parallel`**, then cleans up leaked test pins (see below).
- **Topic only:** `deno task test:core`, `deno task test:cli`, or `deno task test:mcp` (each uses `--parallel`).

## CLI / MCP integration tests: collision avoidance (CRITICAL)

Tests that hit `giterloper_test_knowledge` use a shared remote repository and session-scoped local state. **CLI and gl-maintenance tests must not rely on the implicit `_cli` session** (that would make parallel `deno test` flake on `pinned.yaml`). Use a per–test-file id from `newTestCliSessionId()` in `tests/helpers/gl.ts` and pass `{ sessionId }` into `runGl` / `runGlJson` / `runGlMaintenance` / `runGlMaintenanceJson`, or use the same id in thin local wrappers (`glj` / `glm`). Assert paths under `giterloperSessionRoot(Deno.cwd(), sessionId)` (or equivalent) instead of hardcoding `.giterloper/sessions/_cli`. When calling `cleanupTestKnowledgeRepo` with a `pinName`, include `sessionId` so local `versions/` and `staged/` cleanup targets the correct session.

### 1) Randomize all collision-prone names

Each test file should generate a unique `RUN_ID` at load time:

```js
const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;
```

(`E2E_MARKER` in `tests/helpers/config.ts` is the `"gle2e_"` prefix for scratch pin names—kept under that export name for leak cleanup and older references; CLI/MCP remote scenarios are **topic integration tests**, not a separate “e2e” suite. `scripts/run-tests.ts` removes pins whose names include this marker from every `.giterloper/sessions/*` after the suite finishes.)

Every collision-prone name must include `RUN_ID` (or equivalent entropy):

| Resource | Pattern | Why |
|----------|---------|-----|
| Pin names | `test_knowledge_${RUN_ID}` | `.giterloper/sessions/<sessionId>/versions/<name>/`, `pinned.yaml` |
| Branches (remote) | `${RUN_ID}` or `${RUN_ID}_suffix` | Shared remote; cleanup only deletes our branch |
| Scratch pins | `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}` | Parallel tests; `Date.now()` alone can collide |
| File paths in remote | `knowledge/e2e_${RUN_ID}_${randomBytes(4)}.md` | Avoid overwrites between runs |

Assume tests can run in parallel within a file. Use `crypto.randomBytes` for entropy; `Date.now()` is insufficient.

### 2) Test independence (CRITICAL)

Every test must be self-contained. No test may depend on another test's side effects.

- Tests that write should create their own scratch pins with unique branches.
- Do not use `concurrency: 1` or shared mutable state between tests.

### 3) Session-isolated state

- Each CLI integration **file** uses its own `sessionId` (see `newTestCliSessionId()`); state lives under `.giterloper/sessions/<sessionId>/`.
- Unique session ids prevent parallel test **files** from contending on the same `pinned.yaml`; unique pin names still isolate resources within the remote and under that session’s `versions/` and `staged/`.

### 4) Cleanup and branch isolation

`cleanupTestKnowledgeRepo(source, sha, { pinName, branchName, sessionId })` supports (`sessionId` required when `pinName` is set):

- Legacy (`pinName` string): deletes all remote branches except `main`; use only when no concurrent run can exist.
- Parallel-safe (`{ pinName, branchName }` object): deletes only this run's branch, force-pushes `main`, recreates this run's branch from `main`.

### 5) Pin lifecycle and cloning

`updatePinSha()` and `cmdPinAdd` manage clones:

- when a pin name+SHA is written, clone is created;
- when SHA changes, prior clone is torn down.

`insert`, `merge`, `promote`, and `pin update` all flow through this lifecycle.

- Use `gl pin load` to ensure pins are cloned without adding.
- Use `gl-maintenance clone` only for low-level debugging/maintenance.

## Auth and remote access

CLI and MCP tests that mutate the shared test repo require push access to `github.com/jcwilk/giterloper_test_knowledge`.

- In Cursor Cloud, assume `GITERLOPER_GH_TOKEN` is set.
- Locally, use `GITERLOPER_GH_TOKEN` or authenticate with `gh auth login`.
