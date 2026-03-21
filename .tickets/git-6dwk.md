---
id: git-6dwk
status: open
deps: [git-bmux]
links: []
created: 2026-03-21T21:18:04Z
type: task
priority: 2
assignee: user.email
parent: git-0kbo
---
# lib: wire network git (git.ts, branch.ts, reconcile, pin-lifecycle) to runSoftWithRetry

Use runSoftWithRetry / runGitNetwork (from git-bmux) for network-touching git in lib/git.ts (ls-remote paths), lib/branch.ts (clone/fetch/push-related run("git",...)), lib/pin-lifecycle.ts and lib/reconcile.ts for remote interactions. Pass RetryLogContext (sessionId) from callers that have GlState. Conservative policy for push; avoid blind retry inside fragile multi-step local sequences—retry at outer boundary where plan allows. Local-only git (rev-parse, status, config) stays non-retried or lighter preset per plan.

## Acceptance Criteria

deno check lib/gl.ts. Full test harness passes. Staged clone / pin / reconcile / merge flows still match authoritative behavior (docs/PIN_SETTING_PARAM_BEHAVIOR.md for MCP-facing semantics; no intentional contract drift).

