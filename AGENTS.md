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

(`E2E_MARKER` is `"gle2e_"` from `tests/e2e/config.mjs`. The runner's safety net removes any pins whose name includes this marker after tests finish.)

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

`updatePinSha()` and `cmdPinAdd` manage indices at the low level: when a pin name+SHA is written, we clone and index; when SHA changes, we tear down the old index. `add`, `subtract`, `merge`, `promote`, `reconcile`, `pin update` all flow through this. No manual `gl clone` or `gl index` needed for normal use.

## Gl Script Notes

- **pinQmd** — All QMD invocations go through `pinQmd(pin, args)` which prepends `--index ${pin.name}_${pin.sha}`. No bare qmd wrapper; every call is pinned.
- **pinned.yaml locking** — All writes go through `mutatePins()`, which uses a ticket-based FIFO mutex at `.giterloper/locks/pins/`. Embed operations use a separate mutex at `.giterloper/locks/embed/`.
- **`verifyCloneAtSha`** uses `runSoft` (not `run`) so corrupt/empty clones return `false` instead of throwing. Allows `clonePin` to remove bad dirs and retry.
- **Branched vs branchless pins:** Write ops (`add`, `subtract`, `promote`, `reconcile`, `merge`) require a pin with `branch`. Use `requirePinBranch`.
- **Stale detection:** `assertBranchFresh` fails when local HEAD ≠ remote branch HEAD (ahead or behind). Sync with `gl pin update <name>` or `git -C <staged-dir> pull --rebase`.

## Project Structure

- **`.cursor/skills/gl/`** — CLI skill and `gl.mjs` script
- **`bootstrap/`** — Setup and verification docs
- **`tests/e2e/`** — E2E tests; use `node scripts/run-e2e.mjs` (uses `--test-concurrency=2`)
- **`tests/helpers/`** — `gl.mjs` (runGl, runGlJson), `cleanup.mjs` (cleanupTestKnowledgeRepo)

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

- **Node.js >= 22** and **Git** are available in the VM by default.
- **QMD** — Run `npm install` in the workspace to get the locked `@tobilu/qmd` dependency (used for `gl reconcile` chunking). The CLI also invokes the `qmd` binary (install globally if not on PATH: `npm install -g @tobilu/qmd`).
- No GPU is present in Cloud VMs. CPU-only mode is set via `node .cursor/skills/gl/scripts/gl.mjs gpu --cpu` during setup.

### Git access to knowledge repos

The `cursor[bot]` token only covers `jcwilk/giterloper`. A `GITERLOPER_GH_TOKEN` secret (fine-grained PAT) is needed for the knowledge repos. When set, `gl.mjs` and the E2E test helpers embed it directly in HTTPS URLs at the code level — no gitconfig changes required. The token needs:
- **Read** access to `jcwilk/giterloper_knowledge` (for `gl clone` / `gl index`)
- **Read + Write** access to `jcwilk/giterloper_test_knowledge` (for E2E tests)

Without the secret, `gl` falls back to plain `https://` URLs (works locally with normal git auth, e.g. SSH).

### Running the CLI

All `gl` commands run from the workspace root:
```bash
node .cursor/skills/gl/scripts/gl.mjs <command>
```

See `README.md` Quick start and `bootstrap/` for setup details. After setup, `gl status`, `gl verify`, `gl pin list` confirm the environment is healthy.

### Running tests

```bash
node scripts/run-e2e.mjs
```

E2E tests require **push access** to `github.com/jcwilk/giterloper_test_knowledge` (provided by `GITERLOPER_GH_TOKEN`).

### Build and typecheck

Run `npm install` before first use. Run `npm run typecheck` to verify TypeScript types and that `@tobilu/qmd` resolves correctly. No build step; `gl.mjs` runs directly via Node.

### Embed performance benchmark

To reproduce `qmd embed` timings and verify embeddings:

```bash
node scripts/benchmark-embed.mjs [--runs N]
```

Creates a fixture, runs `qmd embed -f`, times it, and verifies via `vsearch`. Uses `.giterloper-bench/` for isolation.
