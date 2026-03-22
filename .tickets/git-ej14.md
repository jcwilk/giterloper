---
id: git-ej14
status: open
deps: [git-x31b]
links: []
created: 2026-03-22T06:18:04Z
type: task
priority: 1
assignee: user.email
parent: git-cvx0
---
# deno.json: load env file for MCP tasks (+ optional profiles)

Wire `deno.json` tasks so `deno task mcp:serve` and `deno task mcp:serve-stdio` load env via Deno CLI using **`--env-file=` paths that match git-x31b**: default profile **`--env-file=.env.dev`**. Provide a clear selection story for the test profile: (a) alternate tasks (e.g. `mcp:serve:test` and `mcp:serve-stdio:test` loading **`--env-file=.env.test`**), and/or (b) documented `deno run --env-file=...` override for contributors. Prerequisite: user must copy **`.env.example`** → **`.env.dev`** (and a second copy or trimmed **`.env.test`** for test tasks) before tasks succeed—document that in git-m4ln (expected failure if file missing is OK). Do not add dotenv parsing inside `lib/gl-mcp-server*.ts`—env loading stays at the process boundary only. **AGENTS.md copy-paste alignment is git-m4ln**; this ticket owns `deno.json` task strings only. Document minimum Deno version for `--env-file` in AGENTS or CONVENTIONS when tasks rely on it (git-m4ln may place the prose).

## Acceptance Criteria

`deno.json` task definitions visibly include `--env-file=<repo-root-relative path>` for default `mcp:serve` and `mcp:serve-stdio`; paths match git-x31b convention; at least one alternate profile task **or** a documented one-liner in the closing note/commit for the second profile; `./scripts/check_all.sh` green; no `lib/` changes unless unavoidable for the task runner.
