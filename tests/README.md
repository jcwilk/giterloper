# Testing Guide

This document is the canonical reference for test strategy, test execution, harness layout, and integration-test safety constraints.

## Spec anchoring and scope (strict)

**Product-behavior** tests—assertions about what the product **must** do—live only under **`tests/core/`**, **`tests/cli/`**, **`tests/mcp/`**, and **`tests/pin-semantics/`**. Each directory is paired with one **primary** area spec (and related specs where noted); tests strengthen the link between **coded behavior** and **normative spec constraints**. Do not add or keep product-behavior coverage in those trees that has **no** representation in the matching spec (new themes need spec updates in the same change set, unless the user explicitly directs a spec change separately).

| Test folder | Authoritative product spec |
|-------------|----------------------------|
| `tests/core/` | [specs/core.md](../specs/core.md) |
| `tests/pin-semantics/` | [specs/pin-semantics.md](../specs/pin-semantics.md) |
| `tests/cli/` | [specs/cli.md](../specs/cli.md) |
| `tests/mcp/` | [specs/MCP.md](../specs/MCP.md) — **primary** pairing for MCP transport, tools, and startup. **Pin naming, session pin rules, and the branch/ref matrix** (`giterloper_pin_set` law) are normatively defined in [specs/pin-semantics.md](../specs/pin-semantics.md); **`specs/MCP.md`** defers there (do not duplicate that matrix as a second authority in MCP-focused tests). |

**Cross-slice:** **`tests/core/`** exercises shared **library** behavior under **`specs/core.md`** and may still touch pin-adjacent mechanics; **executable pin-law** for **`specs/pin-semantics.md`** lives under **`tests/pin-semantics/`**. Where both specs constrain the same behavior, they must **agree**—no silent conflicting product law across trees.

**Not** every assertion maps to a single spec bullet; the rule is that the **theme** (scenario, contract, or error shape under test) is **covered or implied** in the paired spec so the suite does not encode silent product law. If a test disagrees with its paired area spec, treat the spec as authoritative and align **implementation and tests** to it.

**Harness and helpers** (`tests/helpers/`, the unified runner, AST discovery and scheduling mechanics) are **not** product-behavior specs. Their contracts live **here** (runner, isolation, cleanup, collision rules). [specs/core.md](../specs/core.md) states that helper modules under **`tests/helpers/`** are harness-only and intentionally **not** mirrored in area specs—this README is the operational source for those details.

## Hierarchical alignment

When you touch **behavior** that belongs under a slice spec, treat **spec**, **tests**, and **implementation** as one story: prefer commits or PRs that keep them aligned together (or clearly sequenced) so the layers do not drift without an explicit decision.

---

## Target architecture (canonical)

Treat the following as the **contract** for test layout, isolation, and the unified runner:

### On-disk session layout

- Under the process working directory, **all** giterloper session state lives at **`.giterloper/<sessionId>/`** (for example `pinned.yaml`, `versions/`, `staged/`, indexes, and any session-local locks). Only directories **named by session id** sit directly under `.giterloper/` (no `sessions/` wrapper).

### Runner and parallelism

- **`deno run -A scripts/run-tests.ts`** (and **`deno task test`**) is the full suite entrypoint. The harness:
  - enforces a **single active orchestrator** via an advisory **`flock(2)`** lock on **`<repository-root>/.giterloper-harness.lock`** (see **`scripts/harness-orchestrator-lock.ts`**). The lock file and **`.giterloper-harness.meta.json`** (holder **parent** PID + start-time fingerprint) live **only** at the repo root—**never** under **`.giterloper/`** or **`.giterloper_test/`**, which the harness deletes. **Implementation:** a child process runs **`flock -n -x <lockfile> sh -c 'printf …; exec cat'`** with stdin piped from the harness parent; that child keeps **`LOCK_EX`** until the parent closes stdin in a **`finally`** (a short-lived **`flock -c`** wrapper would release immediately and must not be used). **Waiters** use **non-blocking** **`flock -n`** attempts plus sleep/backoff so they can print **stdout** between tries (not a blocking flock that never returns until acquired). **Stdout policy:** print promptly on the first wait, then about every **3s** and/or whenever the **displayed holder PID** changes (stale or unreadable metadata uses a generic line—see module). If another waiter wins the race, emit the **“Another process acquired…”** line. **Stale records** (dead PID or Linux **fingerprint** mismatch vs **`/proc/<pid>/stat`** **starttime**) are not trusted for messaging; recovery happens only after this process holds **`LOCK_EX`** (metadata is replaced with **write temp + rename**). **Non-Linux:** fingerprint is not read from **`/proc`**; liveness uses **`kill -0`** and the opaque fingerprint **`nonlinux:<pid>`**—PID-reuse is a small documented window. **Bypass:** direct **`deno test tests/...`**, **`deno task test:cli`**, and other per-topic tasks **do not** take this lock—only the unified harness entrypoint does. Regression coverage: **`tests/core/harness-orchestrator-lock.test.ts`** (requires **`flock`** on **`PATH`**; skips when absent).
  - **Composed probes (metadata only):** **`deno task harness:status`** (`scripts/harness-status.ts`) reads **`.giterloper-harness.meta.json`** and classifies **idle / active / stale** with the same **`describeHarnessOrchestratorWaitContext`** logic as the harness wait loop (exit **0** idle, **1** active, **2** stale). **`deno task harness:wait-for-idle`** (`scripts/harness-wait-for-idle.ts`) polls until metadata shows no live orchestrator, with **stdout** throttling aligned to the harness (**~3s** and on PID change). Neither tool acquires the flock, sends signals, or implements a **timeout-then-kill**; they do not replace **`run-tests.ts`** blocking for normal agents. **`--help`** on each script references this README.
  - runs a **fail-closed AST preflight** via **`scripts/discover-test-cases.ts`** (see **AST test discovery** below) and schedules one subprocess per discovered logical case—there is **no** `tests/test-case-manifest.json` and **no** `gen:test-manifest` task;
  - **deletes `<repository-root>/.giterloper`** and **`<repository-root>/.giterloper_test`** if they exist before scheduling so session directories from earlier runs do not accumulate on disk over many suite invocations. This is a **hygiene** step only; it is **not** relied on for parallelism or per-case isolation (tests still use temp `cwd` and unique session ids as below).
  - runs each case as its own **`deno test`** subprocess with an anchored **`--filter`** regex so only that case executes, **`--reporter junit`** to a temp report file, and a **JUnit gate**: parsed summary must show **≥1** executed testcase and **zero** failures/errors (Deno can exit 0 when a filter matches nothing—exit code alone is not sufficient). Harness diagnostics go to **stderr**; subprocess **stderr** is inherited for Deno messages.
  - uses a **bounded worker pool** that **backfills** from the queue as subprocesses finish. **`DENO_JOBS`** sets the number of concurrent workers (default **16** if unset) for **all** discovered logical cases under **`tests/`** (every `*.test.ts` case the AST preflight finds—currently including **`tests/core/`**, **`tests/cli/`**, **`tests/mcp/`**, **`tests/pin-semantics/`**, and any future topic subtrees that follow the same discovery rules).
- There is **no** phase barrier (“all core, then all integration”); scheduling is one global queue capped only by **`DENO_JOBS`**.

### AST test discovery (fail-closed)

The harness uses **`scripts/discover-test-cases.ts`** (TypeScript AST via pinned **`@swc/wasm`**) as a **fail-closed preflight** before scheduling: every `tests/` `*.test.ts` file must expose only **statically named** `Deno.test` registrations. Discovery is the **single** source of logical cases for subprocess scheduling.

**Supported registrations**

- `Deno.test("name", …)` with a string literal first argument.
- `Deno.test({ name: "…", … })` (or `"name": "…"`) with a **string literal** `name` property.

**Rejected (harness exits non-zero before workers)**

- Any `Deno.test` call where the name cannot be resolved statically (template literals, computed `name`, non-literal `name`, spread in the **call** argument list, wrong first-argument shape).
- Any `*.test.ts` file with **zero** discovered cases.
- **Duplicate** resolved names in the **same file** (anchored `--filter` is ambiguous).

**Not discovered**

- Calls through an alias (`const t = Deno.test; t(…)`) or other indirection.
- `Deno.test.only` / `Deno.test.ignore` and other variants are **not** matched (this suite uses plain `Deno.test` only).

Debug: `deno run -A scripts/discover-test-cases.ts` from the repo root prints discovered `{ path, name }` JSON or a non-zero exit with an error message.

### Isolation and helpers

- **Test-only env:** `GITERLOPER_PROJECT_ROOT` (non-empty trimmed path) redirects session state for **`makeState`** and **`lib/mcp-session-store.ts`** to `<GITERLOPER_PROJECT_ROOT>/.giterloper/<sessionId>/` instead of `<cwd>/.giterloper/`. Used by `tests/mcp/mcp-session-store.test.ts` so short-TTL `scavengeStaleSessions` cases do not delete live workspace sessions while other harness cases run in parallel.
- Each logical test case uses a shared **test runtime context**: unique **`sessionId`**, unique **`runId`**, dedicated **`cwd`** (typically a temp directory), state under **`<cwd>/.giterloper/<sessionId>/`**, and **injected** MCP/server/CLI configuration.
- **Transient retries:** Integration tests may trigger the same centralized git/GitHub retries as production; each retry appends one JSON line to **`logs/giterloper-retry.log`** under the repo root (or `GITERLOPER_PROJECT_ROOT`).
- **CLI and gl-maintenance tests** must not rely on the implicit `_cli` session for isolation. Use **`TestRuntimeContext`** from `tests/helpers/test-runtime-context.ts`: `createTestRuntimeContext()` yields a temp **`cwd`**, unique **`sessionId`**, and **`runId`** (for pin/branch/file names). Pass **`{ ctx }`** into `runGl` / `runGlJson` / `runGlMaintenance` / `runGlMaintenanceJson` from `tests/helpers/gl.ts`, or pass explicit **`cwd`** + **`sessionId`**—helpers do **not** default subprocess `cwd` to the repo root. **`runGl` / `runGlMaintenance`** pass **`--mcp-test-mode`** and merge **`integrationMcpModeChildEnv()`** from `tests/helpers/integration-mcp-env.ts` (sets **`TEST_KNOWLEDGE_STORE_REMOTE`**) so CLI subprocesses that write session state use **`.giterloper_test/<sessionId>/`** and the shared test knowledge remote, not **`.giterloper/`** with production-style configuration. Use **`scratchPinName(ctx, prefix)`** for scratch pins; tear down with **`destroyTestRuntimeContext(ctx)`** (often from an **`unload`** listener on the context created for that file or case). For **`cleanupTestKnowledgeRepo`**, pass **`cwd: ctx.cwd`** when **`pinName`** + **`sessionId`** are set so local **`.giterloper_test/<sessionId>/`** trees are removed under the test cwd.
- **MCP tests** must not use **`Deno.env.set` / `delete`** to configure auth, insecure mode, or knowledge-store bootstrap. Pass explicit config into server/app constructors and test factories (see seams in `lib/gl-mcp-server.ts`, `lib/mcp-auth.ts`, `lib/gl-core.ts`, `lib/mcp-session-store.ts`). Production entrypoints may still read env **once** at startup; tests inject config objects instead of mutating process-global env. **`createMcpAppForTest`** defaults **`mcpTestMode`** to **`true`** when omitted so in-process MCP integration tests use **`.giterloper_test`** and **`TEST_KNOWLEDGE_STORE_REMOTE`** semantics unless a case explicitly passes **`mcpTestMode: false`**. Pair **`mcpTestMode: true`** with **`knowledgeStoreRemote`** (or rely on **`TEST_KNOWLEDGE_STORE_REMOTE`** in env) per **`specs/MCP.md`**.

### MCP test mode (integration harness)

Normative detail lives in **`specs/MCP.md`** and **`specs/core.md`**. For this repo’s integration suite:

- **`--mcp-test-mode`** — on **`gl`**, **`gl-maintenance`**, **`lib/gl-mcp-server.ts`**, and **`lib/gl-mcp-server-stdio.ts`**, selects MCP test mode: session state uses **`.giterloper_test`** under the project root (or **`GITERLOPER_PROJECT_ROOT`** when set), and the effective knowledge remote is read from **`TEST_KNOWLEDGE_STORE_REMOTE`** (unless overridden in-process). There is **no** env var that toggles this mode.
- **`TEST_KNOWLEDGE_STORE_REMOTE`** — non-empty valid Git remote for the shared test knowledge repo when MCP test mode is active (via flag or in-process **`mcpTestMode: true`**).
- **`.giterloper_test`** — session base directory name in MCP test mode only; not configurable.

**Requirement:** Any integration entrypoint that spawns **`gl`**, **`gl-maintenance`**, or an MCP server process and expects that process to write session state MUST either use **`runGl` / `runGlMaintenance`** from **`tests/helpers/gl.ts`**, **`createMcpAppForTest`** from **`lib/gl-mcp-server.ts`**, or pass **`--mcp-test-mode`** and merge the same **`integrationMcpModeChildEnv()`** values from **`tests/helpers/integration-mcp-env.ts`** into the child **`env`** (see also **`tests/helpers/mcp-subprocess.ts`** for MCP server spawns). Do not let subprocesses default to **`.giterloper/`** while using the shared test remote.

### MCP test server subprocess inventory (OS processes)

When debugging **`pgrep -af deno`** noise, separate three buckets:

| Bucket | What it is |
|--------|------------|
| **(A) Expected harness concurrency** | The unified runner keeps up to **`DENO_JOBS`** (default **16**) **`deno test`** workers alive; each logical case is its own subprocess. Cases that start an MCP server add **additional** OS processes for the duration of that case. |
| **(B) Post-suite orphans** | Stray **`gl-mcp-server`** / **`with-memsearch`** processes after **all** harness workers have exited — usually a teardown bug (signal only the outer wrapper PID, crash before `finally`, etc.). |
| **(C) External long-lived servers** | Cursor (or other editors) configured to run **`deno task mcp:serve-stdio:test`**, **`mcp:serve:test`**, or equivalent — **not** started by **`scripts/run-tests.ts`**. |

**`with-memsearch` indirection:** Helpers that use **`denoArgsForMcpHttpServer`** / **`denoArgsForMcpStdioServer`** (`tests/helpers/mcp-subprocess.ts`) run **`scripts/with-memsearch.ts`**, which in turn runs a **second** Deno process for the real entrypoint (`lib/gl-mcp-server.ts` or `lib/gl-mcp-server-stdio.ts`); see **`scripts/with-memsearch.ts`** (inner **`Deno.Command`**). Teardown must account for **two** Deno levels, not one.

| Spawn surface | Location | Mechanism | Teardown / notes |
|---------------|----------|-----------|------------------|
| HTTP MCP integration server | **`spawnMcpHttpIntegrationServer`** — `tests/helpers/mcp-subprocess.ts` | **`node:child_process` `spawn`**: outer Deno → **`with-memsearch`** → inner Deno → HTTP server | **`kill()`** on the handle: on Unix, **`detached: true`** + **`process.kill(-pid, "SIGTERM")`** so the **process group** (outer + inner + descendants) is signaled; Windows falls back to **`ChildProcess.kill("SIGTERM")`**. Pair with **`waitForMcpHttpHealth`**. |
| HTTP server consumers | **`tests/mcp/mcp-search-tool.test.ts`**, **`tests/mcp/gl-mcp-workflow.test.ts`** | Call **`spawnMcpHttpIntegrationServer`** | **`server?.kill()`** in **`finally`** after closing MCP clients. |
| Stdio smoke (with memsearch wrap) | **`spawnMcpStdioIntegrationServer`** — `tests/helpers/mcp-subprocess.ts`; **`tests/mcp/mcp-stdio-smoke.test.ts`** | **`node:child_process` `spawn`**: outer Deno → **`with-memsearch`** → inner Deno → stdio MCP (piped stdin/stdout) | Same as HTTP: **`detached: true`** (Unix) + **`kill()`** on the handle uses **`process.kill(-pid, "SIGTERM")`** for the **process group**; **`stdin.end()`**, **`stdout.destroy()`**, then **`await once(proc, "exit")`**. |
| Startup / validation (no `with-memsearch`) | **`tests/mcp/mcp-startup-remote.test.ts`** **`runEntrypoint`** | **`Deno.Command`** `deno run -A <script>` — **one** Deno per invocation, short-lived **`output()`** | Process exits when the entrypoint exits; many invocations per file, different shape from integration servers. |
| In-process MCP (no extra OS server) | **`createMcpAppForTest`** — `lib/gl-mcp-server.ts` | No subprocess server | Not visible as **`gl-mcp-server`** in **`pgrep`**. |
| CLI under test mode | **`runGl` / `runGlMaintenance`** — `tests/helpers/gl.ts` | Subprocess **`gl`** / **`gl-maintenance`** with **`--mcp-test-mode`** | Single child per invocation; uses **`.giterloper_test`**; not the same as spawning **`gl-mcp-server.ts`**. |

**Repro / inventory commands** (repo root; patterns vary by shell quoting):

```bash
pgrep -af 'with-memsearch|gl-mcp-server'
pgrep -af 'gl-mcp-server-stdio'
```

After a full suite, **(B)** should show **no** leftover lines once all **`deno test`** harness workers have finished; **(C)** may still show your editor’s MCP server.

**Source anchors (file:line — may drift on edit):** `tests/helpers/mcp-subprocess.ts` — `withMemsearchWrap`, `denoArgsForMcpHttpServer`, `denoArgsForMcpStdioServer`, `killMcpMemsearchSpawnTree`, `spawnMcpHttpIntegrationServer`, `spawnMcpStdioIntegrationServer`, `waitForMcpHttpHealth`; `scripts/with-memsearch.ts` — inner `Deno.Command` 19–26; `tests/mcp/mcp-search-tool.test.ts` — spawn, `finally` teardown; `tests/mcp/gl-mcp-workflow.test.ts` — spawn, `finally` teardown; `tests/mcp/mcp-stdio-smoke.test.ts` — `spawnMcpStdioIntegrationServer`, readline JSON-RPC, `finally` teardown; `tests/mcp/mcp-startup-remote.test.ts` — `runEntrypoint`; `tests/helpers/gl.ts` — `runGl` / `--mcp-test-mode`, `runGlMaintenance` / `--mcp-test-mode`.

### Cleanup

- Cleanup is **scoped to the current test**: branches, pins, temp dirs, and session dirs that **that test** created.
- The harness **does** remove **repo-root** **`.giterloper/`** and **`.giterloper_test/`** once at suite start (see runner bullets above) so old session trees do not pile up locally; that is unrelated to cross-test isolation guarantees.
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

### Memsearch (`PATH`)

Search and on-disk indexing use the **`memsearch`** CLI (`lib/memsearch-adapter.ts`). The **MCP server** verifies **`memsearch`** at process startup ([specs/MCP.md](../specs/MCP.md)).

**Harness and tasks:** **`deno task test`**, **`deno task check`**, **`./scripts/check_all.sh`**, and the **`mcp:serve` / `mcp:serve-stdio` / `mcp:serve:test` / `mcp:serve-stdio:test`** tasks auto-bootstrap a repo **`.venv`** and **`pip install memsearch`** when the CLI is missing (**`scripts/bootstrap-memsearch.ts`** / **`with-memsearch.ts`**). You still need **Python 3** on **`PATH`**. Subprocess tests that intentionally use a **stripped `PATH`** (for example startup failure cases) are unchanged.

**Manual install** (only if you bypass those entrypoints): `pip install memsearch`, or a venv under **`.venv`** as in [AGENTS.md](../AGENTS.md).

**Required for (normative contract):**

- Any **MCP server** process at startup ([specs/MCP.md](../specs/MCP.md)).
- **`tests/mcp/`** cases that exercise search—hosts must end up with **`memsearch` on `PATH`**; the default **`deno task`** / **`check_all`** paths arrange that automatically.

The **`gl`** / **`gl-maintenance`** CLIs do **not** require memsearch at process startup ([specs/cli.md](../specs/cli.md)); search- or index-backed commands may fail at invocation time if memsearch is missing.

Normative MCP vs CLI rules: [specs/MCP.md](../specs/MCP.md), [specs/cli.md](../specs/cli.md). Install steps also appear in [AGENTS.md](../AGENTS.md).

### MCP `tests/mcp/` and server factories

Normative **product** rules for MCP startup (including **memsearch** on **`PATH`**) live in **[specs/MCP.md](../specs/MCP.md)**. This subsection is **harness-only**: how **`tests/mcp/`** and test factories construct servers without weakening production entrypoints.

- **`tests/mcp/`** cases that exercise **`giterloper_search`** MUST **not** be marked **ignored**, **skipped**, or otherwise bypassed solely because **memsearch** is missing from the environment. Those tests assume a correctly provisioned host (including **memsearch** on **`PATH`**), consistent with the MCP contract. The default **`deno task test`** / **`check_all`** paths bootstrap **memsearch** when absent (see Memsearch above).

- **Test factories:** In-process or subprocess helpers that construct the MCP server without normal production argv/env MUST still enforce the **memsearch** availability rule from **`specs/MCP.md`**, except for a **narrow, documented** hook used only to assert startup failure behavior, which MUST NOT weaken production entrypoints. The implementation exposes **`skipMemsearchVerification`** on **`CreateServerOptions`** (`lib/gl-mcp-server.ts`); production HTTP and stdio entrypoints MUST NOT pass it.

- **`CreateServerOptions` (integration tests):** `createServer` MAY accept an explicit knowledge remote string (and/or aligned override fields) that satisfies startup validation **as if** the corresponding env var for the active mode were set, so subprocess and in-process tests do not rely on polluting parent **`Deno.env`**. Such overrides MUST only be used in test-oriented factories; production entrypoints continue to read env.

### Running all checks

From the repository root, run every check (typecheck, then the full test harness) in the canonical order; the script exits on first failure:

```bash
./scripts/check_all.sh
```

Or via Deno: `deno task check`

Use this before persisting ticket work (for example verifier and work-next use it to validate changes).

### Parallel execution

- Cap subprocess concurrency with **`DENO_JOBS`** (integer; default 16 in the harness) for every logical case.
- **`tests/cli/`**, **`tests/mcp/`**, **`tests/core/`**, **`tests/pin-semantics/`**, and any other discovered product-behavior trees follow the **same** isolation rules: no reliance on shared repo-root **`.giterloper/`** or **`.giterloper_test/`** or mutable **`Deno.env`** between concurrent cases (CLI uses `TestRuntimeContext` plus **`integrationMcpModeChildEnv`** in subprocesses; MCP uses **`createMcpAppForTest`** with default test mode).

### Layout and individual commands

Tests are grouped by **topic**, not by duration:

| Directory | Role |
|-----------|------|
| `tests/core/` | Fast, local library behavior (paths, pinned state, queues, etc.) |
| `tests/pin-semantics/` | Executable **pin-law** coverage ([specs/pin-semantics.md](../specs/pin-semantics.md)): `giterloper_pin_set`, branch/ref matrix, session vs named pins, and related errors |
| `tests/cli/` | `gl` / `gl-maintenance` workflows against a real remote |
| `tests/mcp/` | MCP server behavior, including HTTP client workflow tests |

- **Typecheck:** `deno check lib/gl.ts` — required when touching TypeScript; run with test changes.
- **Full test suite (CI-equivalent):** `deno run -A scripts/run-tests.ts` — runs the unified harness (bounded parallel case execution per target architecture above).
- **Topic only:** `deno task test:core`, `deno task test:cli`, `deno task test:mcp`, or `deno task test:pin-semantics` — scoped runs under `tests/core/`, `tests/cli/`, `tests/mcp/`, or `tests/pin-semantics/` for fast feedback; same isolation expectations as the full suite.

## CLI / MCP integration tests: collision avoidance (CRITICAL)

Tests that hit `giterloper_test_knowledge` use a shared remote repository. Local state must remain **per session** and **per test case** under **`<cwd>/.giterloper_test/<sessionId>/`** when using the integration helpers (MCP test mode).

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

- Each logical case has its own `sessionId` and cwd; state lives under **`.giterloper_test/<sessionId>/`** beneath that cwd when helpers set MCP test mode (default for CLI/MCP integration paths documented above).
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

Optional future work to reduce live GitHub traffic in MCP tests (fixtures, local bare repos, record/replay, tiered CI) is deferred; no separate design doc is checked in.
