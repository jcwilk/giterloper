# Agent Guidance for Giterloper

This document captures conventions, gotchas, and guidance for AI agents and contributors working in this repository.

## Task Tracking

Use the ticket system for all work.

- `./tk ready` — available tasks (open/in-progress, deps resolved)
- `./tk start <id>` — begin work on a ticket
- `./tk close <id>` — close after verification
- `./tk show <id>` — full ticket details

**Task completion requires commit and push.** A closed ticket with a dirty tree is not done.

**Workflow** (`/work-next`): Run `./tk ready`, pick the top ticket, `./tk start <id>`, read with `./tk show <id>`, then implement, validate, close, commit, and push.

**Cursor skill commands**: `/work-next`, `/work-all`, `/file-tickets`, `/persist`, `/archive-tickets` — see `.cursor/skills/ticket/SKILL.md`.

## Coding Conventions

See [CONVENTIONS.md](./CONVENTIONS.md) for type-safety, interface/type usage, and strict mode requirements.

## E2E Tests: Collision Avoidance (CRITICAL)

E2E tests use a **shared remote repository** (`giterloper_test_knowledge`) and **shared local state** (`.giterloper/`, `pinned.yaml`). To avoid collisions:

### 1. Randomize All Collision-Prone Names

**RUN_ID** — Each test file generates a unique `RUN_ID` at load time:

```js
const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;
```

(`E2E_MARKER` is `"gle2e_"` from `tests/e2e/config.ts`. The runner's safety net removes any pins whose name includes this marker after tests finish.)

**Every** name that could collide MUST include `RUN_ID` or equivalent entropy:

| Resource | Pattern | Why |
|----------|---------|-----|
| Pin names | `test_knowledge_${RUN_ID}` | `.giterloper/versions/<name>/`, `pinned.yaml` |
| Branches (remote) | `${RUN_ID}` or `${RUN_ID}_suffix` | Shared remote; cleanup only deletes our branch |
| Scratch pins | `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}` | Parallel tests; `Date.now()` alone can collide |
| File paths in remote | `knowledge/e2e_${RUN_ID}_${randomBytes(4)}.md` | Avoid overwriting between runs |

**Be paranoid:** Assume tests can run in parallel within a file. Use `crypto.randomBytes` for entropy; `Date.now()` is insufficient.

### 2. Test Independence (CRITICAL)

**Every test MUST be self-contained.** No test may depend on another test's side effects. Tests that need to write should create their own scratch pins with unique branches. Do not use `concurrency: 1` or shared mutable state between tests.

### 3. Shared State: pinned.yaml

- **`.giterloper/pinned.yaml`** — Both test files read/write this. With random pin names they don't collide. Writes are protected by a FIFO mutex (`.giterloper/locks/pins/`).
- **`.giterloper/versions/` and `staged/`** — Keyed by pin name; unique names avoid collisions.

### 4. Cleanup and Branch Isolation

`cleanupTestKnowledgeRepo(source, sha, { pinName, branchName })` supports two modes:

- **Legacy (string):** `pinName` only — deletes ALL remote branches except main. Use when no other run can be active.
- **Parallel-safe (object):** `{ pinName, branchName }` — deletes only our branch, force-pushes main, creates our branch from main. Other runs' branches are untouched.

### 5. Pin Lifecycle

`updatePinSha()` and `cmdPinAdd` manage clones: when a pin name+SHA is written, we clone; when SHA changes, we tear down the old clone. `insert`, `merge`, `promote`, `pin update` flow through this. Use `gl pin load` to ensure pins are cloned without adding; use `gl-maintenance clone` for low-level cloning.

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

Nested format for pins with optional branch:

```yaml
name:
  repo: source
  sha: commit-sha
  branch: branch-name  # optional; required for write ops
```

Branchless pins are read-only.

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

```bash
deno run -A scripts/run-e2e.ts
```

Unit tests: `deno test -A tests/unit/`

E2E tests require push access to `github.com/jcwilk/giterloper_test_knowledge`; use GITERLOPER_GH_TOKEN (cloud) or `gh auth login` (local).

### MCP server

The MCP server exposes giterloper over HTTP/SSE (Streamable HTTP). No stdio transport. See `docs/MCP_API_CONTRACT.md` for tool names, schemas, and error codes.

**Run:**
```bash
deno run -A lib/gl-mcp-server.ts
# or
deno task mcp:serve
```

**Config:** `MCP_PORT` (default 3443), `MCP_HOST` (default 127.0.0.1).

**Endpoints:** `GET /health` — health diagnostics (unauthenticated); `GET|POST /mcp` — MCP Streamable HTTP (requires auth unless insecure mode).

**Authentication:**
- By default, MCP requests require `Authorization: Bearer <token>` where the token matches `MCP_TOKEN`.
- Set `MCP_INSECURE=true` (or `MCP_INSECURE=1`) to skip auth for **local development only**. Do not use in production.
- Unauthorized requests return 401 with `{ ok: false, code: "unauthorized", message: "Authentication required", details: {} }`.

### Typecheck

Run `deno check lib/gl.ts` to verify TypeScript. No build step required—Deno runs TypeScript directly.
