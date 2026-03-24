---
id: git-05a6
status: open
deps: []
links: []
created: 2026-03-24T03:39:39Z
type: epic
priority: 2
assignee: user.email
---
# Epic: test harness mutex, reliability, and operator tooling

Problem: Multiple concurrent full-suite runs and/or many gl-mcp-server --mcp-test-mode processes cause .giterloper_test (and repo-root session trees) to appear/disappear and create verifier/agent flakes (e.g. concurrent run-tests.ts startup deletes vs in-flight workers). Sources include: (1) scripts/run-tests.ts removing .giterloper/.giterloper_test at harness start; (2) parallel per-case deno test subprocesses; (3) MCP integration tests spawning HTTP/stdio servers via tests/helpers/mcp-subprocess.ts (node child_process) if not always reaped; (4) external Cursor MCP configs using test-mode servers at scale. Goal: impossible to start a second unified harness while the first is alive; stale lock recovery via live-PID checks; composed operator scripts; audit per-case parallelism and subprocess lifecycle; document agent policy (wait before kill; never kill watched runs without explicit user OK).

**Scope:** In-repo unified harness (`scripts/run-tests.ts` and callers) and MCP integration subprocess lifecycle. **Out of scope for product code changes:** arbitrary Cursor IDE MCP configuration—mitigate via documentation only unless a tiny, safe repo hook is explicitly agreed later.

**Child split (avoid duplicate audit work):** **git-ed8c** owns the single PID lock contract (live-PID checks); **git-ep51** consumes that contract only (no second lock mechanism). **git-7qgy** = OS processes for `gl-mcp-server*` / `with-memsearch` chains, teardown, external MCP. **git-n14t** = harness scheduler (`run-tests.ts`, `discover-test-cases.ts`, `DENO_JOBS`, per-case `deno test`, process-global env in worker processes)—cross-reference **git-7qgy** for leaked MCP children instead of duplicating spawn inventory.

**Non-goals:** Reducing per-case parallelism unless an audit finds a defect; changing verifier agent definition unless explicitly requested—operational mitigation is mutex + docs + **git-ep51** scripts.

**Epic acceptance (when children close):** Second concurrent invocation of documented harness entrypoints fails fast with clear diagnostics and stale-PID recovery; operator scripts follow wait/default-kill-after-timeout policy in **git-ep51**; audits produce bounded findings with the split above.

