---
id: git-bmux
status: closed
deps: []
links: []
created: 2026-03-21T21:18:01Z
type: task
priority: 2
assignee: user.email
parent: git-0kbo
---
# lib: retry-external module, fetchWithRetry, runSoftWithRetry, logs

Add shared retry infrastructure in lib/ (name e.g. lib/retry-external.ts) per plan centralized_external_retries_8c5f6622: append-only logging under repo-relative logs/ (single shared file, e.g. logs/giterloper-retry.log); mkdir logs/ as needed; gitignore log file(s); on log write failure fall back once to stderr with same line (or one explicit policy). logRetryAttempt(meta): ISO timestamp, Deno.pid, sessionId when available (optional RetryLogContext from GlState/MCP), optional role cli|mcp|test, operation label, attempt/maxAttempts, waitMs, capped error snippet. computeBackoffMs with jitter. gitTransientMessage() consolidating patterns from tests/helpers/run-git.ts and gl.ts (network, TLS, upload-pack/null SHA, ENOBUFS, getcwd/cwd loss, etc.). githubResponseRetry(res, bodyText?) and fetchWithRetry using GitHub headers: prefer retry-after; x-ratelimit-remaining/reset (epoch seconds); retry 5xx and 429; 403 only when rate-limit/secondary limit; do not retry 401/422; never treat merge conflict 409 as transient. runSoftWithRetry / runGitNetwork preset: loop runSoft for network git subcommands only (clone, fetch, pull, push, ls-remote, etc.); local commands rev-parse/status/config non-retried or lighter policy. Document destructive/partial-progress caution: start with network git + fetch; push conservative; avoid blind retry of multi-step local commit without outer boundary.

## Design

Keep lib/run.ts as primitive; new module calls runSoft. MCP/CLI JSON stdout must stay clean—no retry spam on stdout.

## Acceptance Criteria

deno check lib/gl.ts passes. New unit tests under tests/core/ (or tests/helpers/) exercise githubResponseRetry / header-derived waitMs with synthetic Response objects (retry-after, x-ratelimit-reset when remaining 0, 5xx vs 401/422 no-retry). Log file path and field semantics documented in ticket note or follow-up doc ticket. No consumer migration required in this ticket beyond exporting APIs used by follow-up tickets.

