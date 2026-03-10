# Agent Guidance for Giterloper

This document captures conventions, gotchas, and guidance for AI agents and contributors working in this repository.

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
| Pin names | `test_knowledge_${RUN_ID}` | `.giterloper/versions/<name>/`, `pinned.yaml`, QMD collections |
| Branches (remote) | `${RUN_ID}` or `${RUN_ID}_suffix` | Shared remote; cleanup only deletes our branch |
| Scratch pins | `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}` | Parallel tests; `Date.now()` alone can collide |
| File paths in remote | `knowledge/e2e_${RUN_ID}_${randomBytes(4)}.md` | Avoid overwriting between runs |

**Be paranoid:** Assume tests can run in parallel within a file. Use `crypto.randomBytes` for entropy; `Date.now()` is insufficient.

### 2. Test Independence (CRITICAL)

**Every test MUST be self-contained.** No test may depend on another test's side effects. Tests that need to write should create their own scratch pins with unique branches. Do not use `concurrency: 1` or shared mutable state between tests.

### 3. Shared State: pinned.yaml and QMD

- **`.giterloper/pinned.yaml`** — Both test files read/write this. With random pin names they don't collide. Writes are protected by a FIFO mutex (`.giterloper/locks/pins/`).
- **QMD** — Uses `--index` per pin+SHA via `pinQmd(pin, args)` in `gl.mjs`. Each pin+SHA has its own SQLite DB and YAML config. XDG_CONFIG_HOME and XDG_CACHE_HOME are set to `.giterloper/qmd/{config,cache}` for the whole repo.
- **`.giterloper/versions/` and `staged/`** — Keyed by pin name; unique names avoid collisions.

### 4. Cleanup and Branch Isolation

`cleanupTestKnowledgeRepo(source, sha, { pinName, branchName })` supports two modes:

- **Legacy (string):** `pinName` only — deletes ALL remote branches except main. Use when no other run can be active.
- **Parallel-safe (object):** `{ pinName, branchName }` — deletes only our branch, force-pushes main, creates our branch from main. Other runs' branches are untouched.

### 5. Auto-Index Lifecycle

`updatePinSha()` and `cmdPinAdd` manage indices at the low level: when a pin name+SHA is written, we clone and index; when SHA changes, we tear down the old index. `add`, `subtract`, `merge`, `promote`, `reconcile`, `pin update` all flow through this. No manual `gl-extended clone` or `gl-extended index` needed for normal use.

## Gl Script Notes

- **pinQmd** — All QMD invocations go through `pinQmd(pin, args)` which prepends `--index ${pin.name}_${pin.sha}`. No bare qmd wrapper; every call is pinned.
- **pinned.yaml locking** — All writes go through `mutatePins()`, which uses a ticket-based FIFO mutex at `.giterloper/locks/pins/`. Embed operations use a separate mutex at `.giterloper/locks/embed/`.
- **`verifyCloneAtSha`** uses `runSoft` (not `run`) so corrupt/empty clones return `false` instead of throwing. Allows `clonePin` to remove bad dirs and retry.
- **Branched vs branchless pins:** Write ops (`add`, `subtract`, `promote`, `reconcile`, `merge`) require a pin with `branch`. Use `requirePinBranch`.
- **Stale detection:** `assertBranchFresh` fails when local HEAD ≠ remote branch HEAD (ahead or behind). Sync with `gl pin update <name>` or `git -C <staged-dir> pull --rebase`.

## Project Structure

- **`lib/`** — TypeScript source for the gl CLI (paths, reconcile, pinned, git, etc.)
- **`.cursor/skills/gl/scripts/gl`** — Executable shell script; run from workspace root
- **`bootstrap/`** — Setup and verification docs
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
- **QMD** — The CLI invokes the `qmd` binary (install globally if not on PATH: `npm install -g @tobilu/qmd`). Chunking for `gl reconcile` uses a pure TypeScript implementation in `lib/chunk.ts`.
- No GPU is present in Cloud VMs. CPU-only mode is set via `./scripts/gl-extended gpu --cpu` during setup.

### Git access to knowledge repos

**GITERLOPER_GH_TOKEN is available in this environment.** The Cursor Cloud VM is configured with this secret. You do not need to check for it or warn that it might be missing — assume it is set.

The `cursor[bot]` token only covers `jcwilk/giterloper`. The `GITERLOPER_GH_TOKEN` secret (fine-grained PAT) is used for the knowledge repos. When set, gl and the E2E test helpers embed it directly in HTTPS URLs at the code level — no gitconfig changes required. The token provides:
- **Read** access to `jcwilk/giterloper_knowledge` (for clone/index, e.g. via `gl pin add` or `gl-extended clone`)
- **Read + Write** access to `jcwilk/giterloper_test_knowledge` (for E2E tests)

E2E tests will run successfully in this environment.

### Running the CLI

All `gl` commands run from the workspace root:
```bash
./.cursor/skills/gl/scripts/gl <command>
```

See `README.md` Quick start and `bootstrap/` for setup details. After setup, `diagnostic`, `pin list` confirm the environment is healthy.

### gl extended (debugging and maintenance)

A separate **gl extended** CLI exposes low-level commands for debugging and maintenance. It is **not** listed in the gl skill and agents should **not** use it for normal workflows.

**Invoke gl extended:**
```bash
./scripts/gl-extended <command>
# or
deno run -A lib/gl-extended.ts <command>
```

**Commands:** `status`, `verify`, `gpu`, `clone`, `index`, `teardown`, `stage`, `stage-cleanup`, `promote`. Run `./scripts/gl-extended --help` for usage.

**When to use:** Only when debugging failed operations, performing manual maintenance (e.g. re-cloning, re-indexing without pin add), or running tests. Prefer main `gl` commands (`diagnostic`, `pin add`, `pin update`, etc.) for normal agent workflows.

**Directive:** Do **not** invoke gl extended for routine tasks. If a main gl command fails, run `gl diagnostic` first to understand state. Use gl extended only when explicitly debugging/maintaining (e.g. user asks to re-clone, or you are fixing a corrupted index). Prefer the narrower main command surface to reduce confusion and make agent behavior easier to debug.

### Running tests

```bash
deno run -A scripts/run-e2e.ts
```

Unit tests: `deno test -A tests/unit/`

E2E tests require push access to `github.com/jcwilk/giterloper_test_knowledge`; **GITERLOPER_GH_TOKEN is available in this environment** and provides that access.

### Typecheck

Run `deno check lib/gl.ts` to verify TypeScript. No build step required—Deno runs TypeScript directly.

### Embed performance benchmark

To reproduce `qmd embed` timings and verify embeddings:

```bash
deno run -A scripts/benchmark-embed.ts [--runs N]
```

Creates a fixture, runs `qmd embed -f`, times it, and verifies via `vsearch`. Uses `.giterloper-bench/` for isolation.
