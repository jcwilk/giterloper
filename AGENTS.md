# Agent Guidance for Giterloper

This document captures conventions, gotchas, and guidance for AI agents and contributors working in this repository.

**Layered truth (root vs `specs/` vs tests vs code):** read the full mandate in **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](./HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)**—it defines orthogonality, precedence within a product slice, **`docs/` demotion** (operational notes, not a lock on product truth), **hierarchical alignment** vs **hierarchical divergence**, verifier expectations for area specs, and rules for spec scope and growth.

**This file is the canonical place** to nudge reading other root onboarding/instruction docs, the mandate, **`specs/*`**, [tests/README.md](./tests/README.md), and the ticket **verifier** (`.cursor/agents/verifier.md`) for agent workflows. For **verifier**-shaped gates, **spawn** the **`verifier`** subagent via Task—do not impersonate it inline (see **Skills vs agents** below). **`specs/`**, **tests/README**, the verifier definition, and **`lib/`** do not repeat “see AGENTS” hooks; they assume these universal rules. **Routine edits to AGENTS.md are rare and human-directed**—do not treat refreshing AGENTS, filing tickets for wording-only AGENTS churn, or spec-change machinery as default workflow for small doc tweaks.

**Orthogonality** (root instructions vs `specs/*`) is defined in the mandate (**§1**). Area specs conform to repo-wide root instructions, not the other way around.

## Skills vs agents (orchestration)

**`.cursor/skills/`** is for procedures the **current** agent executes **inline** in this conversation: read the skill, follow it here, use normal tools.

**`.cursor/agents/`** is for **subagent** workflows: spawn with the **Task** tool using the matching **`subagent_type`** (for example **`verifier`**, **`work-next`**, or the **`cross-critique-*`** critique lanes). Pass a self-contained prompt; the subagent owns its loop.

**Always respect the folder boundary.** Do **not** open an **`agents/*.md`** file and “just do what it says” in the parent thread—that collapses agents into skills and drops delegation, filing review, and isolation the definitions assume. **Strong nudge:** when the user points at an **agent** definition or names **`verifier`**, **`work-next`**, **`/cross-critique`**, or the **`cross-critique-*`** lanes, **spawn via Task** as those workflows specify (for **`/cross-critique`**, four parallel read-only lanes per **`.cursor/skills/cross-critique/SKILL.md`**)—do **not** impersonate them inline—unless the user **explicitly** asks you to waive delegation and work inline. **Product spec edits** use the **`/spec-change`** skill (`.cursor/skills/spec-change/SKILL.md`) **inline**, not a subagent.

## Source-of-truth precedence (CRITICAL)

**Layer order**, **repair direction** when spec, tests, and code disagree on product behavior, **`docs/` demotion**, **alignment vs divergence**, **rollout and ongoing test/spec pairing**, **spec scope**, **conflict examples**, and **required agent behaviors** are defined in **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](./HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)** (**§2**, **Summary**, and related sections). **Read that document** for the full stack; this section does not duplicate it.

**Where to read contracts:** Within a slice, use the area specs—for example [`specs/pin-semantics.md`](./specs/pin-semantics.md) for `pin_set` / session-pin / branch-ref rules, [`specs/core.md`](./specs/core.md) for shared library behavior, [`specs/cli.md`](./specs/cli.md) for CLI behavior, and [`specs/MCP.md`](./specs/MCP.md) for MCP tools, errors, and transport parity.

**Pairing slice specs with user-visible strings:** **[specs/cli.md](./specs/cli.md)** and **CLI help text** (and other user-visible CLI contract text) should stay **intentionally in sync**. **[specs/MCP.md](./specs/MCP.md)** and **MCP tool descriptions / user-visible MCP strings** should stay **intentionally in sync**. **A conflict between the slice spec and its paired user-facing strings is a bug**—fix help, descriptions, spec, or implementation **together**; do not silently prefer one side. Slice specs **do not** need to cite AGENTS or restate the full repo-wide stack.

**Normative MCP behavior** is defined only under **[specs/MCP.md](./specs/MCP.md)** (and related area specs); there is no separate MCP contract at the repository root.

**Judgement and spec edits:** When work introduces **materially new** product behavior that belongs in the written contract, update the relevant **`specs/*`** in **task-scoped** fashion only (no drive-by spec edits; no numeric “coverage” quota—use judgement). See the mandate for strict alignment at rollout, **what “mention” means** in specs (**§6**), and pairing rules.

**Changing normative contracts** (editing authoritative area specs, revising CLI/MCP-facing contract text, or implementing behavior that contradicts them) requires **explicit user direction**—do not "fix" drift by silently rewriting the contract.

## Task Tracking

Use the `Ticket` system (`wedow/ticket`) for all tracked work. Access it via `./tk`. Run `./tk` with no arguments to see full usage (create, start, close, ready, blocked, closed, show, dep, etc.). There is no `./tk list` command — use `ready` / `blocked` / `closed` to list tickets.

**Task completion requires commit and push.** A closed ticket with a dirty tree is not done.

Ticket operations are typically induced by user-invoked **skills** (inline) or **agents** (spawn via Task), for example:
- `/work-all` (`.cursor/skills/work-all/SKILL.md`)
- `/realign-divergences` (`.cursor/skills/realign-divergences/SKILL.md`) — compare behavior to `specs/*`, file tickets, then `work-all`
- `/file-tickets` (`.cursor/skills/file-tickets/SKILL.md`)
- `/archive-tickets` (`.cursor/skills/archive-tickets/SKILL.md`)
- `/spec-change` (`.cursor/skills/spec-change/SKILL.md`) — edit **`specs/*`**, file **forward** alignment tickets only when owed, **never** start/close tickets in this flow
- `/work-next` — spawn **`.cursor/agents/work-next.md`** as subagent (`work-next`), do not inline

## Multi-model critique (review, not tickets)

For **deep review**—correctness, design, spec alignment, or high-stakes decisions before you implement or file work—use **`/cross-critique`**: the parent spawns four read-only **`cross-critique-*`** Task lanes in one turn and reconciles their reports (**`.cursor/skills/cross-critique/SKILL.md`**). This flow is **not** part of the ticket lifecycle; it does not create, close, or replace `./tk` work.

## Run environment: native for dev/test, Docker for prod

**Development and tests** use **native Deno** (and git; **Python + memsearch** when running the MCP server or search-related tests) on the host. This keeps feedback loops fast for agents and contributors: run the CLI, MCP server, and tests directly without container overhead. **MCP** treats **memsearch** as mandatory at server startup ([specs/MCP.md](./specs/MCP.md)); **`gl`** / **`gl-maintenance`** do not require it at CLI boot ([specs/cli.md](./specs/cli.md)).

### memsearch (install and `PATH`)

Giterloper invokes the **`memsearch`** CLI as a subprocess; see `lib/memsearch-adapter.ts` and [docs/DEPLOYMENT_REQUIREMENTS.md](./docs/DEPLOYMENT_REQUIREMENTS.md) §2 for runtime assumptions. **MCP** still **fails fast** if `memsearch` is not on **`PATH`** at process start ([specs/MCP.md](./specs/MCP.md)).

**Default ingress (no manual venv step):** **`./scripts/check_all.sh`**, **`deno task check`**, **`deno task test`**, and the **`mcp:serve` / `mcp:serve-stdio` / `mcp:serve:test` / `mcp:serve-stdio:test`** **`deno.json`** tasks run through **`scripts/bootstrap-memsearch.ts`** / **`scripts/with-memsearch.ts`**. If `memsearch` is not already available, they create **repo-root `.venv`**, **`pip install memsearch`** there, and prepend **`.venv/bin`** (or **`.venv/Scripts`** on Windows) to **`PATH`** for that process and its children. **Python 3** must be on **`PATH`** (`python3 -m venv`).

**Manual install** (optional—for shells where you invoke **`deno run lib/gl-mcp-server.ts`** directly without **`with-memsearch`**, or to match production Docker):

```bash
pip install memsearch
# or: python3 -m venv .venv && .venv/bin/pip install memsearch
```

The **`gl`** / **`gl-maintenance`** CLIs do **not** require memsearch at process startup ([specs/cli.md](./specs/cli.md)); search- or index-backed commands may fail at invocation time if memsearch is missing.

- **CLI:** `./.cursor/skills/gl/scripts/gl` from workspace root.
- **MCP server:** `deno task mcp:serve` / `mcp:serve-stdio` from workspace root (loads repo-root **`.env`** via Deno **`--env-file`**; copy **`.env.example`** → **`.env`** and fill remotes first). For MCP test mode (session under **`.giterloper_test`**), use **`mcp:serve:test`** / **`mcp:serve-stdio:test`**. Raw **`deno run`** without **`--env-file`** does not load **`.env`**—either use the tasks or pass **`--env-file=.env`** yourself.
- **Tests:** `deno run -A scripts/run-tests.ts` (or `deno task test`) runs the unified harness: logical cases are discovered via **`scripts/discover-test-cases.ts`** (AST, fail-closed); each case is a separate **`deno test`** subprocess with a JUnit report and a **≥1 testcase / zero failures** gate (see [tests/README.md](./tests/README.md)). A **bounded worker pool** backfills from the queue; concurrency is capped only by **`DENO_JOBS`** (default **16**) for all cases under `tests/core/`, `tests/cli/`, and `tests/mcp/`. Integration tests use per-case temp `cwd`, session state under **`.giterloper/<sessionId>/`** or **`.giterloper_test/<sessionId>/`** when MCP test mode applies, and **injected** MCP/config (not mutable process-global `Deno.env` in tests). The harness deletes **repo-root** **`.giterloper/`** and **`.giterloper_test/`** once at suite start so session dirs from prior runs do not accumulate (disk hygiene, not the isolation model). Typecheck: `deno check lib/gl.ts`.

**Production** uses **Docker**. The same image runs on Fly.io (see [docs/FLY_IO_DEPLOYMENT.md](./docs/FLY_IO_DEPLOYMENT.md)). Optional: run the MCP server in Docker locally for parity with production (`./scripts/run-docker.sh`); day-to-day dev and tests remain native.

## Coding Conventions

See [CONVENTIONS.md](./CONVENTIONS.md) for type-safety, interface/type usage, and strict mode requirements.

## Testing Strategy (CRITICAL)

A rigorous, thoughtfully designed test suite is essential for agentic coding. It is the clearest way to verify that implemented behavior matches intended behavior.

Topic integration tests—especially MCP workflow tests against a live remote—are especially valuable as executable workflow documentation for both humans and agents. Keep that coverage high-signal and intentionally scoped: less is more. Avoid overlapping scenarios and competing sources of truth. CLI-facing behavior lives in `tests/cli/` (real `gl` / `gl-maintenance`); higher-level agent paths live in `tests/mcp/`.

Use [tests/README.md](./tests/README.md) as the canonical source for all test-specific guidance (execution, shared-remote collision avoidance, independence, cleanup rules, and the target harness layout under `.giterloper/<sessionId>/`).

## External retries (git, GitHub)

Transient network and GitHub REST failures are retried in `lib/retry-external.ts` (bounded attempts, jittered backoff). Each retry is logged as one append-only JSON line under `logs/giterloper-retry.log` (repo root, or `GITERLOPER_PROJECT_ROOT` when set): ISO timestamp, process id, optional `sessionId` and `role` (`cli` / `mcp` / `test`), operation label, attempt/maxAttempts, wait ms, and a short error snippet. If the log file cannot be written, the same line is emitted once on stderr. See epic ticket `git-0kbo` for background. MCP/CLI JSON stdout stays free of retry noise.

## Gl Script Notes

- **pinned.yaml** — All writes go through `mutatePins()`. Each session has its own pinned.yaml under `.giterloper/<sessionId>/`; no cross-session locking.
- **`verifyCloneAtSha`** uses `runSoft` (not `run`) so corrupt/empty clones return `false` instead of throwing. Allows `clonePin` to remove bad dirs and retry.
- **Branched vs branchless pins:** Write ops (`insert`, `promote`, `merge`) require a pin with `branch`. Use `requirePinBranch`.
- **Stale detection:** `assertBranchFresh` fails when local HEAD ≠ remote branch HEAD (ahead or behind). Sync with `gl pin update <name>` or `git -C <staged-dir> pull --rebase`.

## Project Structure

- **`lib/`** — TypeScript source for the gl CLI (paths, add-queue, pinned, git, etc.)
- **`.cursor/skills/gl/scripts/gl`** — Executable shell script; run from workspace root
- **`tests/core/`**, **`tests/cli/`**, **`tests/mcp/`** — topic-based tests; full suite: `deno run -A scripts/run-tests.ts` or `deno task check`
- **`tests/helpers/`** — `gl.ts` (runGl, runGlJson), `cleanup.ts` (cleanupTestKnowledgeRepo), `mcp-test-auth.ts` (in-process MCP HTTP test auth defaults)

## pinned.yaml Format

State is session-scoped: `.giterloper/<sessionId>/pinned.yaml`. CLI defaults to session `_cli`; use `--session-id <id>` to override. MCP uses per-connection session ids. The session pin is always named `_session`; omit the `pin` parameter in MCP tools to target it.

```yaml
_session:
  repo: source
  sha: commit-sha
  branch: branch-name  # optional; required for write ops
my_feature:
  repo: source
  sha: commit-sha
  branch: branch-name
```

Branchless pins are read-only.

### MCP session pin (_session) and pin_set semantics

`giterloper_pin_set` semantics are defined in [`specs/pin-semantics.md`](./specs/pin-semantics.md). Treat that document as the single source of truth for pin/session behavior, branch/ref handling, and error semantics.

## Cursor Cloud specific instructions

### Prerequisites

- **Deno** and **Git** are available in the VM. If Deno is missing: `curl -fsSL https://deno.land/install.sh | sh`
- For **MCP server** runs or tests that exercise search: **Python** + **`pip install memsearch`** with **`memsearch` on `PATH`** (see **Run environment** → **memsearch** above).

### Git access to knowledge repos

**Cloud:** GITERLOPER_GH_TOKEN is available in Cursor Cloud. Assume it is set.

**Local:** Either set GITERLOPER_GH_TOKEN or use session-based auth (`gh auth login` for merge API; git credential helper for clone/push).

When GITERLOPER_GH_TOKEN is set, gl and the integration test helpers embed it in HTTPS URLs — no gitconfig changes required. When not set, git operations use credential helper (e.g. `gh auth git-credential`), and the merge API uses `gh auth token`. The token provides:
- **Read** access to `jcwilk/giterloper_knowledge` (for clone, e.g. via `gl pin add` or `gl-maintenance clone`)
- **Read + Write** access to `jcwilk/giterloper_test_knowledge` (for CLI/MCP integration tests)

CLI and MCP integration tests will run successfully in this environment when the token is available. Flows that start the MCP server or exercise **`giterloper_search`** also need **`memsearch` on `PATH`** (see **Run environment** → **memsearch** above).

### Running the CLI

All `gl` commands run from the workspace root:
```bash
./.cursor/skills/gl/scripts/gl <command>
```

**Setup:** For **`gl`** alone, git and Deno suffice. For the **MCP server** or suites that exercise **memsearch**-backed search, install **memsearch** on **`PATH`** first (see **Run environment** → **memsearch**). Use `gl pin add` to add a pin (clones automatically) or `gl pin load` to clone existing pins. Run `gl diagnostic` to verify state.

### gl maintenance (debugging and maintenance)

A separate **gl maintenance** CLI exposes low-level commands for debugging and maintenance. It has **no overlap** with main gl commands.

**Invoke gl maintenance:**
```bash
./scripts/gl-maintenance <command>
# or
deno run -A lib/gl-maintenance.ts <command>
```

**Commands:** `status`, `verify`, `clone`, `teardown`, `stage`, `stage-cleanup`, `promote`. Run `./scripts/gl-maintenance --help` for usage.

**When to use:** Only when debugging failed operations, performing manual maintenance (e.g. re-cloning without pin add), or running tests. Prefer main `gl` commands (`diagnostic`, `pin add`, `pin update`, `pin load`, etc.) for normal agent workflows.

**Directive:** Do **not** invoke gl maintenance for routine tasks. If a main gl command fails, run `gl diagnostic` first to understand state. Use gl maintenance only when explicitly debugging/maintaining (e.g. user asks to re-clone, or you are fixing a corrupted clone). Prefer the narrower main command surface to reduce confusion and make agent behavior easier to debug.

### Running tests

See [tests/README.md](./tests/README.md) for canonical test execution commands and integration-test prerequisites (shared test repo, auth).

### MCP server

The MCP server exposes giterloper over **HTTP/SSE** (Streamable HTTP) or **stdio**. Same tools and session semantics; see [specs/MCP.md](./specs/MCP.md) for tool names, error shape, and the dual-transport parity contract. Omitting the `pin` argument targets the **session pin** (stored as `_session`); do not pass `_session` as the pin name—it is reserved. Use `giterloper_pin_set` to view or configure the session pin, or to upsert named pins without changing which pin is the session pin. **Parity guardrail:** When changing tools or session behavior, change only the shared core (`createServer` in `lib/gl-mcp-server.ts`) so both transports stay in sync; add transport-specific logic only in the HTTP app or stdio entrypoint.

**Index isolation:** Search/index backends (memsearch when implemented) enforce per pin+sha isolation. Querying pin+sha A can never read index for pin+sha B. No cross-version index reuse; stale or mismatched metadata causes explicit failure (fail closed). See `lib/memsearch-adapter.ts`.

**Local env file (operational):** Committed **`.env.example`** lists **`KNOWLEDGE_STORE_REMOTE`** and **`TEST_KNOWLEDGE_STORE_REMOTE`** (empty placeholders). Copy to gitignored **`.env`** and set values. Variable **semantics** and mode rules are normative in [`specs/MCP.md`](./specs/MCP.md); there is **no** env var that toggles MCP test mode—use the **`--mcp-test-mode`** flag on the server entrypoint (or the **`:test`** `deno` tasks below).

**Run (native; default for dev):** Prefer `deno task` so **`--env-file=.env`** is applied (requires a Deno build that supports **`deno run --env-file=...`**—current stable Deno satisfies this).
```bash
deno task mcp:serve
# or
deno task mcp:serve-stdio
```
MCP test mode (uses **`TEST_KNOWLEDGE_STORE_REMOTE`**, state under **`.giterloper_test`**):
```bash
deno task mcp:serve:test
deno task mcp:serve-stdio:test
```
Equivalent manual invocations load the same file: `deno run -A --env-file=.env lib/gl-mcp-server.ts` (append **`--mcp-test-mode`** for test mode).

**Cursor (stdio MCP):** The MCP server process does **not** read the repo **`.env`** automatically. Put the same **names** and **values** (including both knowledge remotes if you use test-mode commands) into **Cursor Settings → MCP** for this server, or export them in the parent environment before Cursor starts the server.

For production (Fly.io) or optional local Docker run, see [docs/FLY_IO_DEPLOYMENT.md](./docs/FLY_IO_DEPLOYMENT.md).

**Config:** `MCP_PORT` (default 3443), `MCP_HOST` (default 127.0.0.1). **`KNOWLEDGE_STORE_REMOTE`** is **required** for normal MCP server startup (non-empty valid Git remote URL, e.g. `https://github.com/owner/repo`). The server fails fast at boot if it is missing or invalid. Each new MCP session bootstraps the **`_session`** pin from that remote at its default branch HEAD before tool handlers run; repository identity is server-defined only (MCP tools do not accept a client `source` override). For automation or integration-style stacks that use session state under **`.giterloper_test`**, start the MCP entrypoint with **`--mcp-test-mode`** (or a **`:test`** task) and set **`TEST_KNOWLEDGE_STORE_REMOTE`**—see [`specs/MCP.md`](./specs/MCP.md) and [`tests/README.md`](./tests/README.md). Use the same flag on **`gl`** / **`gl-maintenance`** when subprocesses must write under **`.giterloper_test`**.

**Endpoints:** `GET /health` — health diagnostics (unauthenticated); `GET|POST /mcp` — MCP Streamable HTTP (requires auth unless insecure mode).

**Authentication:**
- By default, MCP requests require `Authorization: Bearer <token>` where the token matches `MCP_TOKEN`.
- Set `MCP_INSECURE=true` (or `MCP_INSECURE=1`) to skip auth for **local development only**. Do not use in production.
- Unauthorized requests return 401 with `{ ok: false, code: "unauthorized", message: "Authentication required", details: {} }`.

### Typecheck

Run `deno check lib/gl.ts` to verify TypeScript. No build step required—Deno runs TypeScript directly.
