# Testing Guide

This document is the canonical reference for test strategy, test execution, and integration-test safety constraints.

It is **not** the canonical source for product behavior semantics. Behavior semantics are defined by authoritative markdown specs (for example `docs/PIN_SETTING_PARAM_BEHAVIOR.md`). If tests conflict with those specs, update tests (and code) to match the authoritative markdown contract.

## Target architecture (canonical)

The repository is converging on the layout and runner described in [docs/TEST_PARALLELISM_PLAN.md](../docs/TEST_PARALLELISM_PLAN.md). Treat the following as the **contract** for new test and product work:

### On-disk session layout

- Under the process working directory, **all** giterloper session state lives at **`.giterloper/<sessionId>/`** (for example `pinned.yaml`, `versions/`, `staged/`, indexes, and any session-local locks). Only directories **named by session id** sit directly under `.giterloper/` (no `sessions/` wrapper).

### Runner and parallelism

- **`deno run -A scripts/run-tests.ts`** (and **`deno task test`**) is the full suite entrypoint. The harness:
  - reads **`tests/test-case-manifest.json`** (one entry per `Deno.test` name + source file). Regenerate after adding or renaming tests: **`deno task gen:test-manifest`**;
  - after validating the manifest, **deletes `<repository-root>/.giterloper`** if it exists so session directories from earlier runs do not accumulate on disk over many suite invocations. This is a **hygiene** step only; it is **not** relied on for parallelism or per-case isolation (tests still use temp `cwd` and unique session ids as below).
  - runs each case as its own **`deno test`** subprocess with an anchored **`--filter`** regex so only that case executes;
  - uses a **bounded worker pool** that **backfills** from the queue as subprocesses finish. **`DENO_JOBS`** sets the number of concurrent workers (default **16** if unset) for **all** manifest cases (`tests/core/`, `tests/cli/`, `tests/mcp/`).
- There is **no** phase barrier (“all core, then all integration”); scheduling is one global queue capped only by **`DENO_JOBS`**.

### Isolation and helpers

- **Test-only env:** `GITERLOPER_PROJECT_ROOT` (non-empty trimmed path) redirects session state for **`makeState`** and **`lib/mcp-session-store.ts`** to `<GITERLOPER_PROJECT_ROOT>/.giterloper/<sessionId>/` instead of `<cwd>/.giterloper/`. Used by `tests/mcp/mcp-session-store.test.ts` so short-TTL `scavengeStaleSessions` cases do not delete live workspace sessions while other manifest cases run in parallel.
- Each logical test case uses a shared **test runtime context**: unique **`sessionId`**, unique **`runId`**, dedicated **`cwd`** (typically a temp directory), state under **`<cwd>/.giterloper/<sessionId>/`**, and **injected** MCP/server/CLI configuration.
- **CLI and gl-maintenance tests** must not rely on the implicit `_cli` session for isolation. Use **`TestRuntimeContext`** from `tests/helpers/test-runtime-context.ts`: `createTestRuntimeContext()` yields a temp **`cwd`**, unique **`sessionId`**, and **`runId`** (for pin/branch/file names). Pass **`{ ctx }`** into `runGl` / `runGlJson` / `runGlMaintenance` / `runGlMaintenanceJson` from `tests/helpers/gl.ts`, or pass explicit **`cwd`** + **`sessionId`**—helpers do **not** default subprocess `cwd` to the repo root. Use **`scratchPinName(ctx, prefix)`** for scratch pins; tear down with **`destroyTestRuntimeContext(ctx)`** (often from an **`unload`** listener on the context created for that file or case). For **`cleanupTestKnowledgeRepo`**, pass **`cwd: ctx.cwd`** when **`pinName`** + **`sessionId`** are set so local `.giterloper/` trees are removed under the test cwd.
- **MCP tests** must not use **`Deno.env.set` / `delete`** to configure auth, insecure mode, or knowledge-store bootstrap. Pass explicit config into server/app constructors and test factories (see seams in `lib/gl-mcp-server.ts`, `lib/mcp-auth.ts`, `lib/gl-core.ts`, `lib/mcp-session-store.ts`). Production entrypoints may still read env **once** at startup; tests inject config objects instead of mutating process-global env.

### Cleanup

- Cleanup is **scoped to the current test**: branches, pins, temp dirs, and session dirs that **that test** created.
- The harness **does** remove **repo-root** **`.giterloper/`** once at suite start (see runner bullets above) so old session trees do not pile up locally; that is unrelated to cross-test isolation guarantees.
- Aside from that, the default runner path does **not** perform other suite-wide sweeps across remote branches or shared-remote state. A separate **debug-only** leak cleaner may exist for manual recovery; it is not part of the parallel happy path.

---

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

From the repository root, run every check (typecheck, then the full test harness) in the canonical order; the script exits on first failure:

```bash
./scripts/check_all.sh
```

Or via Deno: `deno task check`

Use this before persisting ticket work (e.g. verifier and work-next use it to validate changes).

### Parallel execution

- Cap subprocess concurrency with **`DENO_JOBS`** (integer; default 16 in the harness) for every logical case.
- **`tests/cli/`**, **`tests/mcp/`**, and **`tests/core/`** follow the **same** isolation rules: no reliance on shared repo-root `.giterloper/` or mutable **`Deno.env`** between concurrent cases (CLI uses `TestRuntimeContext`; MCP uses injected `createMcpAppForTest` options).

### Layout and individual commands

Tests are grouped by **topic**, not by duration:

| Directory | Role |
|-----------|------|
| `tests/core/` | Fast, local library behavior (paths, pinned state, queues, etc.) |
| `tests/cli/` | `gl` / `gl-maintenance` workflows against a real remote |
| `tests/mcp/` | MCP server behavior, including HTTP client workflow tests |

- **Typecheck:** `deno check lib/gl.ts` — required when touching TypeScript; run with test changes.
- **Full test suite (CI-equivalent):** `deno run -A scripts/run-tests.ts` — runs the unified harness (bounded parallel case execution per target architecture above).
- **Topic only:** `deno task test:core`, `deno task test:cli`, or `deno task test:mcp` — scoped runs under `tests/core/`, `tests/cli/`, or `tests/mcp/` for fast feedback; same isolation expectations as the full suite.

## CLI / MCP integration tests: collision avoidance (CRITICAL)

Tests that hit `giterloper_test_knowledge` use a shared remote repository. Local state must remain **per session** and **per test case** under **`<cwd>/.giterloper/<sessionId>/`**.

Use the shared helpers (`tests/helpers/gl.ts`, `tests/helpers/test-runtime-context.ts`, `tests/helpers/cleanup.ts`) so every case gets:

- a unique **`sessionId`** for the whole case (not shared across cases in the same file unless the file is a single case);
- a unique **`runId`** on **`TestRuntimeContext`** (or equivalent `RUN_ID`) embedded in pin names, branches, and remote file paths;
- **`cleanupTestKnowledgeRepo(...)`** (or successors) in **branch- and pin-scoped** modes only—never legacy “delete all branches” modes while any parallel run can exist.

### 1) Randomize all collision-prone names

Each logical test case should have a unique `RUN_ID` (or derive it from the test context):

```js
const RUN_ID = `${E2E_MARKER}${randomUUID().replace(/-/g, "")}`;
```

(`E2E_MARKER` in `tests/helpers/config.ts` is the `"gle2e_"` prefix for scratch pin names—kept under that export name for leak cleanup and older references; CLI/MCP remote scenarios are **topic integration tests**, not a separate “e2e” suite.)

Every collision-prone name must include `RUN_ID` (or equivalent entropy):

| Resource | Pattern | Why |
|----------|---------|-----|
| Pin names | `test_knowledge_${RUN_ID}` | `.giterloper/<sessionId>/versions/<name>/`, `pinned.yaml` |
| Branches (remote) | `${RUN_ID}` or `${RUN_ID}_suffix` | Shared remote; cleanup only deletes our branch |
| Scratch pins | `${prefix}_${RUN_ID}_${randomUUID().replace(/-/g, "")}` (`scratchPinName`) | Parallel cases; `Date.now()` alone can collide |
| File paths in remote | `knowledge/e2e_${RUN_ID}_${randomBytes(4)}.md` | Avoid overwrites between runs |

Assume **logical cases** can run in parallel with any other case. Use `crypto.randomUUID()` / `randomBytes` for entropy; `Date.now()` is insufficient.

### 2) Test independence (CRITICAL)

Every test must be self-contained. No test may depend on another test's side effects.

- Tests that write should create their own scratch pins with unique branches.
- Do not use shared mutable state between tests (including shared `Deno.env` mutation).

### 3) Session-isolated state

- Each logical case has its own `sessionId` and cwd; state lives under **`.giterloper/<sessionId>/`** beneath that cwd.
- Unique session ids prevent contention on the same `pinned.yaml`; unique pin names isolate resources on the shared remote and under `versions/` and `staged/`.

### 4) Cleanup and branch isolation

`cleanupTestKnowledgeRepo(source, sha, { pinName, branchName, sessionId })` supports (`sessionId` required when `pinName` is set):

- **Scoped (`{ pinName, branchName }`):** deletes only this run's branch, reconciles `main` only as defined by the helper’s contract for that test—safe for parallel cases when each case uses distinct branch names.
- **Legacy broad modes** (e.g. deleting all non-`main` branches) are **not** compatible with parallel execution; do not use them in the default suite.

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

Optional future work to reduce live GitHub traffic in MCP tests is outlined in [docs/MCP_TEST_REMOTE_MOCKING.md](../docs/MCP_TEST_REMOTE_MOCKING.md).
