---
id: git-y614
status: open
deps: [git-jp1p]
links: []
created: 2026-03-24T05:35:41Z
type: feature
priority: 1
assignee: user.email
parent: git-wiud
---
# Harness: wire run-tests to per-run tests/roots + child env

**Does not** reimplement GC/allocate — **call** the API from **`git-jp1p`** after the harness flock is held; obtain the absolute path to the new run directory.

**Env:** set **`GITERLOPER_MCP_TEST_SESSION_PARENT`** (constant from `lib/session-layout.ts` after `git-toud`) to the **absolute** path returned by **`git-jp1p`** for **every** `deno test` worker: **`runOne`** must pass an explicit merged `env` = **full parent process env** (`Deno.env.toObject()` or equivalent) **plus** override for the session-parent key — do **not** drop `PATH`, `HOME`, `GITERLOPER_GH_TOKEN`, etc. **All workers in one harness invocation share the same path.**

**Ordering:** after memsearch + discovery (same section as today’s hygiene), run **allocate+GC** (`jp1p`), then schedule workers.

**Hygiene:** choose and document one policy for repo-root **`.giterloper`** / **`.giterloper_test`** deletion (e.g. **keep** deleting both for suite hygiene while sessions live under `tests/roots/...`, or narrow — must match `tests/README`). **Bypass** / topic tasks: **do not** duplicate full doc here; **`git-5skn`** owns `deno.json` + manual `deno test` workflow; this ticket ensures harness path is correct and README points at bypass behavior.

## Acceptance Criteria

- `./scripts/check_all.sh` passes; `deno task test` uses an isolated session parent under `tests/roots/`.
- Every harness worker process receives the same `GITERLOPER_MCP_TEST_SESSION_PARENT` value for that run.
- Repo-root deletion policy documented and consistent with new layout.
