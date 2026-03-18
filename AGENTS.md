# Agent Guidance for Giterloper

This document captures conventions, gotchas, and guidance for AI agents and contributors working in this repository.

## Source-of-truth precedence (CRITICAL)

When requirements conflict, follow this precedence order:

1. **Authoritative markdown specs** (highest), especially documents that define exact behavior with words like "MUST", "exact", or "single source of truth" (for example `docs/PIN_SETTING_PARAM_BEHAVIOR.md`).
2. **Tests** (next): tests are executable checks, but they are not allowed to redefine behavior that authoritative markdown already specifies.
3. **Current code** (lowest): code may drift and must be updated to match the higher-priority sources.

Required behavior for agents:
- If tests conflict with authoritative markdown, treat the tests as stale and propose/implement updates that restore alignment with markdown specs.
- If code conflicts with tests and markdown, align code to markdown first, then align tests to the same contract.
- Never file or execute work that moves behavior away from authoritative markdown unless the user explicitly requests a spec change.

## Task Tracking

Use the `Ticket` system (`wedow/ticket`) for all tracked work. Access it via `./tk`. Run `./tk` with no arguments to see full usage (create, start, close, ready, blocked, closed, show, dep, etc.). There is no `./tk list` command — use `ready` / `blocked` / `closed` to list tickets.

**Task completion requires commit and push.** A closed ticket with a dirty tree is not done.

Ticket operations are typically induced by user-invoked skills/subagents such as:
- `/work-all` (`.cursor/skills/work-all/SKILL.md`)
- `/file-tickets` (`.cursor/skills/file-tickets/SKILL.md`)
- `/archive-tickets` (`.cursor/skills/archive-tickets/SKILL.md`)
- `/work-next` (`.cursor/agents/work-next.md`)

## Run environment: native for dev/test, Docker for prod

**Development and tests** use **native Deno** (and git, Python, memsearch) on the host. This keeps feedback loops fast for agents and contributors: run the CLI, MCP server, and tests directly without container overhead.

- **CLI:** `./.cursor/skills/gl/scripts/gl` from workspace root.
- **MCP server:** `deno task mcp:serve` or `deno run -A lib/gl-mcp-server.ts` from workspace root.
- **Tests:** `deno test -A tests/unit/`, `deno run -A scripts/run-e2e.ts`; typecheck: `deno check lib/gl.ts`.

**Production** uses **Docker**. The same image runs on Fly.io (see [docs/FLY_IO_DEPLOYMENT.md](./docs/FLY_IO_DEPLOYMENT.md)). Optional: run the MCP server in Docker locally for parity with production (`./scripts/run-docker.sh`); day-to-day dev and tests remain native.

## Coding Conventions

See [CONVENTIONS.md](./CONVENTIONS.md) for type-safety, interface/type usage, and strict mode requirements.

## Testing Strategy (CRITICAL)

A rigorous, thoughtfully designed test suite is essential for agentic coding. It is the clearest way to verify that implemented behavior matches intended behavior.

E2E tests are especially important because they act as executable workflow documentation for both humans and agents. Keep E2E tests high-signal and intentionally scoped: less is more. Avoid overlapping coverage and competing sources of truth.

Use [tests/README.md](./tests/README.md) as the canonical source for all test-specific guidance (execution, E2E collision avoidance, independence, and cleanup rules).

## Gl Script Notes

- **pinned.yaml locking** — All writes go through `mutatePins()`, which uses a ticket-based FIFO mutex at `.giterloper/locks/pins/`.
- **`verifyCloneAtSha`** uses `runSoft` (not `run`) so corrupt/empty clones return `false` instead of throwing. Allows `clonePin` to remove bad dirs and retry.
- **Branched vs branchless pins:** Write ops (`insert`, `promote`, `merge`) require a pin with `branch`. Use `requirePinBranch`.
- **Stale detection:** `assertBranchFresh` fails when local HEAD ≠ remote branch HEAD (ahead or behind). Sync with `gl pin update <name>` or `git -C <staged-dir> pull --rebase`.

## Project Structure

- **`lib/`** — TypeScript source for the gl CLI (paths, add-queue, pinned, git, etc.)
- **`.cursor/skills/gl/scripts/gl`** — Executable shell script; run from workspace root
- **`tests/e2e/`** — E2E tests; use `deno run -A scripts/run-e2e.ts`
- **`tests/helpers/`** — `gl.ts` (runGl, runGlJson), `cleanup.ts` (cleanupTestKnowledgeRepo)

## pinned.yaml Format

Nested format for pins with optional branch. The session pin is always named `_session`; omit the `pin` parameter in MCP tools to target it.

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

`giterloper_pin_set` semantics are defined in [docs/PIN_SETTING_PARAM_BEHAVIOR.md](./docs/PIN_SETTING_PARAM_BEHAVIOR.md). Treat that document as the single source of truth for pin/session behavior, branch/ref handling, and error semantics.

## Cursor Cloud specific instructions

### Prerequisites

- **Deno** and **Git** are available in the VM. If Deno is missing: `curl -fsSL https://deno.land/install.sh | sh`

### Git access to knowledge repos

**Cloud:** GITERLOPER_GH_TOKEN is available in Cursor Cloud. Assume it is set.

**Local:** Either set GITERLOPER_GH_TOKEN or use session-based auth (`gh auth login` for merge API; git credential helper for clone/push).

When GITERLOPER_GH_TOKEN is set, gl and the E2E test helpers embed it in HTTPS URLs — no gitconfig changes required. When not set, git operations use credential helper (e.g. `gh auth git-credential`), and the merge API uses `gh auth token`. The token provides:
- **Read** access to `jcwilk/giterloper_knowledge` (for clone, e.g. via `gl pin add` or `gl-maintenance clone`)
- **Read + Write** access to `jcwilk/giterloper_test_knowledge` (for E2E tests)

E2E tests will run successfully in this environment.

### Running the CLI

All `gl` commands run from the workspace root:
```bash
./.cursor/skills/gl/scripts/gl <command>
```

**Setup:** Prerequisites are git and Deno. Use `gl pin add` to add a pin (clones automatically) or `gl pin load` to clone existing pins. Run `gl diagnostic` to verify state.

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

See [tests/README.md](./tests/README.md) for canonical test execution commands and E2E prerequisites.

### MCP server

The MCP server exposes giterloper over **HTTP/SSE** (Streamable HTTP) or **stdio**. Same tools and session semantics; see [MCP.md](./MCP.md) for tool names, schemas, error codes, and the dual-transport parity contract. Tools that omit the `pin` parameter resolve through the session pin (_session). Use `giterloper_pin_set` to view or configure the session pin, or to upsert named pins without changing which pin is the session pin. **Parity guardrail:** When changing tools or session behavior, change only the shared core (`createServer` in `lib/gl-mcp-server.ts`) so both transports stay in sync; add transport-specific logic only in the HTTP app or stdio entrypoint.

**Index isolation:** Search/index backends (memsearch when implemented) enforce per pin+sha isolation. Querying pin+sha A can never read index for pin+sha B. No cross-version index reuse; stale or mismatched metadata causes explicit failure (fail closed). See `docs/MEMSEARCH_ADAPTER.md`.

**Run (native; default for dev):**
```bash
deno run -A lib/gl-mcp-server.ts
# or
deno task mcp:serve
```
For stdio (one session per process): `deno task mcp:serve-stdio` or `deno run -A lib/gl-mcp-server-stdio.ts`.
For production (Fly.io) or optional local Docker run, see [docs/FLY_IO_DEPLOYMENT.md](./docs/FLY_IO_DEPLOYMENT.md).

**Config:** `MCP_PORT` (default 3443), `MCP_HOST` (default 127.0.0.1). `KNOWLEDGE_STORE_REMOTE` — when set (e.g. `https://github.com/owner/repo`), new MCP sessions auto-create the session pin (_session) at the remote repo's `main` HEAD; useful for agent workflows without manual pin setup. If unset, the session starts with no pins; use `pin_set` with source and branch/ref to create the session pin.

**Endpoints:** `GET /health` — health diagnostics (unauthenticated); `GET|POST /mcp` — MCP Streamable HTTP (requires auth unless insecure mode).

**Authentication:**
- By default, MCP requests require `Authorization: Bearer <token>` where the token matches `MCP_TOKEN`.
- Set `MCP_INSECURE=true` (or `MCP_INSECURE=1`) to skip auth for **local development only**. Do not use in production.
- Unauthorized requests return 401 with `{ ok: false, code: "unauthorized", message: "Authentication required", details: {} }`.

### Typecheck

Run `deno check lib/gl.ts` to verify TypeScript. No build step required—Deno runs TypeScript directly.
