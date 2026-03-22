---
id: git-6iyp
status: closed
deps: [git-gws2]
links: []
created: 2026-03-20T03:24:43Z
type: chore
priority: 2
assignee: user.email
parent: git-lqvd
---
# Aggressive repeated full-suite runs (flake hunt)

After the harness changes land (default DENO_JOBS=16, no separate CLI/MCP cap), run ./scripts/check_all.sh from repository root repeatedly in one session without mutating env beyond what is normal for CI (use defaults). Goal: very aggressive stability signal on shared-remote + parallel subprocess load.

## Design

This ticket is evidence-only; no product code unless a failure forces a bugfix (then split bugfix vs re-run as needed).

## Acceptance Criteria

At least 50 consecutive successful exits (exit code 0) for ./scripts/check_all.sh on the same commit/state as the merged harness changes. Record in ./tk close note: date, machine/context if relevant, exact loop command used (e.g. for i in $(seq 1 50); do ...), and that all 50 passed. If any run fails, stop; fix flakiness or remote/test isolation in a follow-up ticket and restart the count from 1 after fix merges.


## Notes

**2026-03-20T11:03:08Z**

Stress validation (2026-03-20, Linux CI-like env, default DENO_JOBS): 50 consecutive ./scripts/check_all.sh passes. Loop: for i in $(seq 1 50); do ./scripts/check_all.sh || exit 1; done (with tee to .check_all_50_git6iyp.log). Final line ALL_50_PASSED 2026-03-20T04:02:47-07:00. Fixes during hunt: ensureWorkingClone reclones when staged HEAD != pin.sha (lib/branch.ts); test runId/scratchPinName UUID entropy (test-runtime-context, gl-mcp-workflow, tests/README); runGit transient patterns for upload-pack null ref; reference_client callToolJson retries for MCP remote flakes; mcp-pin-set reqToolJson for success-path tools/call.
