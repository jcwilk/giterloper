---
id: git-mrig
status: closed
deps: [git-bmux]
links: []
created: 2026-03-21T21:18:03Z
type: task
priority: 2
assignee: user.email
parent: git-0kbo
---
# lib/github.ts: use fetchWithRetry + rate-limit waits

Migrate all lib/github.ts fetch() calls to fetchWithRetry from retry-external (git-bmux). On retryable responses await computed waitMs, log via logRetryAttempt with MCP/CLI session context where the caller can pass RetryLogContext (thread through mergeBranchesRemotely / resolvePartialShaViaGithub / getFileAddEpochViaApi as feasible). Preserve merge 201/204/409 semantics; only add retries for transient classes per githubResponseRetry. getFileAddEpochViaApi must still return 0 on ultimate failure (soft failure).

## Design

If passing session id through every github function is too invasive, document minimal context (e.g. operation tag only) and extend in a follow-up—prefer threading from gl-mcp-server and gl CLI entrypoints where state exists.

## Acceptance Criteria

deno check lib/gl.ts. Integration behavior unchanged for success paths; no new MCP tool error schema (per plan). ./scripts/check_all.sh or deno run -A scripts/run-tests.ts passes.

