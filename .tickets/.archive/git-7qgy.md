---
id: git-7qgy
status: closed
deps: []
links: []
created: 2026-03-24T03:39:50Z
type: task
priority: 1
assignee: user.email
parent: git-05a6
---
# Audit: MCP test server subprocess lifecycle and external spawners

Investigate sources of many concurrent `deno` / `gl-mcp-server*.ts` / `--mcp-test-mode` processes (observed via `pgrep`). **Distinguish:** (A) **expected** concurrency during a unified harness run (`DENO_JOBS` workers × tests that spawn servers) vs (B) **post-suite orphans** vs (C) **external** long-lived Cursor MCP stdio servers.

**In-repo OS-process inventory (extend as needed; include file:line):**
- `tests/helpers/mcp-subprocess.ts` — `node:child_process` `spawn` → outer `deno` runs `scripts/with-memsearch.ts`, which spawns **inner** `deno` for `lib/gl-mcp-server.ts`; assess whether `kill()` on the outer PID always reaps grandchildren.
- Consumers: `tests/mcp/mcp-search-tool.test.ts`, `tests/mcp/gl-mcp-workflow.test.ts` (and any other `spawnMcpHttpIntegrationServer` call sites).
- `tests/mcp/mcp-stdio-smoke.test.ts` — `Deno.Command` + `denoArgsForMcpStdioServer(['--mcp-test-mode'])`.
- `tests/mcp/mcp-startup-remote.test.ts` — short-lived `runEntrypoint` / `Deno.Command`…`output()` (many invocations; different shape than `with-memsearch` servers).
- **Not** `pgrep` sources: in-process `createMcpAppForTest` (`lib/gl-mcp-server.ts`); CLI `--mcp-test-mode` via `tests/helpers/gl.ts` (different surface—note for `.giterloper_test` contention only).

**Out-of-repo:** Cursor MCP configs using `mcp:serve-stdio:test` / similar—document; not the unified harness.

Deliverables: tests/README.md subsection (preferred): spawn API table, teardown paths, expected vs leak, optional reproducible `pgrep` commands for closure notes. Follow-up tickets for code fixes (e.g. process-group **SIGTERM for MCP test subprocess teardown / orphan cleanup**—**not** killing the unified harness orchestrator or waiters; epic **git-05a6** forbids orchestrator kill-after-timeout).

## Acceptance Criteria

- Audit doc with file:line references and **with-memsearch** indirection called out.
- Critical leaks fixed or child tickets filed; closure note includes **reproducible** inventory commands (e.g. `pgrep -af 'gl-mcp-server|with-memsearch'`).
- Verifier/AGENTS edits only if essential; prefer tests/README for harness-adjacent guidance.


## Notes

**2026-03-24T04:16:50Z**

Audit: tests/README.md subsection MCP test server subprocess inventory — spawn table, with-memsearch double-Deno callout, buckets (A) DENO_JOBS+harness (B) orphans (C) Cursor MCP. File:line refs for mcp-subprocess, consumers, mcp-stdio-smoke, mcp-startup-remote, createMcpAppForTest, runGl.

Fix: spawnMcpHttpIntegrationServer (tests/helpers/mcp-subprocess.ts) uses detached spawn on Unix + process.kill(-pid,SIGTERM) to reap inner Deno from with-memsearch; Windows unchanged.

Follow-up ticket git-crjq (parent git-05a6): mcp-stdio-smoke Deno.Command teardown still signals outer PID only.

Inventory: pgrep -af 'with-memsearch|gl-mcp-server' and pgrep -af 'gl-mcp-server-stdio'
