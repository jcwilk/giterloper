---
id: git-05a6
status: closed
deps: []
links: []
created: 2026-03-24T03:39:39Z
type: epic
priority: 2
assignee: user.email
---
# Epic: test harness mutex, reliability, and operator tooling

Problem: Multiple concurrent full-suite runs and/or many gl-mcp-server --mcp-test-mode processes cause .giterloper_test (and repo-root session trees) to appear/disappear and create verifier/agent flakes (e.g. concurrent run-tests.ts startup deletes vs in-flight workers). Sources include: (1) scripts/run-tests.ts removing .giterloper/.giterloper_test at harness start; (2) parallel per-case deno test subprocesses; (3) MCP integration tests spawning HTTP/stdio servers via tests/helpers/mcp-subprocess.ts (node child_process) if not always reaped; (4) external Cursor MCP configs using test-mode servers at scale.

**Goal (orchestrator):** Exactly **one** canonical harness mutates harness session trees at a time. **Second and later invocations block** (do not exit early with an error) until the current orchestrator finishes, printing **clear, throttled STDOUT** so agents and humans know what is happening—including when **multiple waiters** race so one sees another acquire before them. **No** default **kill-after-timeout** of the active harness: queued agents must wait quietly; killing a runner while others wait would be chaotic.

**Minimum stdout intents** (exact wording may vary; **git-ed8c** owns final strings and tests/README policy): (1) waiting on a known orchestrator PID; (2) another waiter won the race—now waiting on the new holder PID; (3) this process acquired the lock and is running as orchestrator (self PID).

**Scope:** In-repo unified harness (`scripts/run-tests.ts` and callers) and MCP integration subprocess lifecycle. **Out of scope for product code changes:** arbitrary Cursor IDE MCP configuration—mitigate via documentation only unless a tiny, safe repo hook is explicitly agreed later.

**Child split (avoid duplicate audit work):** **git-ed8c** owns the lock contract, **blocking acquisition**, and user-visible wait messages. **git-ep51** provides thin **operator scripts** (status, optional wait-for-idle) aligned with that contract—**no** orchestrator kill-after-timeout paths. **git-7qgy** = OS processes for `gl-mcp-server*` / `with-memsearch` chains, teardown, external MCP. **git-n14t** = harness scheduler (`run-tests.ts`, `discover-test-cases.ts`, `DENO_JOBS`, per-case `deno test`, process-global env)—cross-reference **git-7qgy** for leaked MCP children instead of duplicating spawn inventory.

**Non-goals:** Reducing per-case parallelism unless an audit finds a defect; changing verifier agent definition unless explicitly requested; **automated harness termination** to “make room” for waiters (explicit human-only emergency tooling, if any, must not be default and is out of scope for this epic unless a separate ticket explicitly adds it).

**Epic acceptance (when children close):** Extra harness invocations **block** until the active orchestrator releases the lock, with documented stdout patterns; stale lock recovery still works; **git-ep51** scripts do not implement kill-after-timeout; audits produce bounded findings with the split above.

