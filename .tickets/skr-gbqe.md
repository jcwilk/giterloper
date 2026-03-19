---
id: skr-gbqe
status: open
deps: [skr-vakd]
links: []
created: 2026-03-19T20:46:24Z
type: feature
priority: 2
assignee: user.email
parent: skr-scn7
---
# Enable full parallel Deno test execution (files and safe in-file)

Turn on deno test --parallel for the unified suite (respect DENO_JOBS where useful). Where Deno supports per-test parallelism and tests are isolated (no shared process-global state), enable it; otherwise document why specific files stay serial. Remove any runner comments that require serial execution solely due to fixable _cli contention once session helpers land. Ensure check_all.sh (or replacement) invokes parallel mode. Goal: wall time dominated by unavoidable network/git work, not artificial serialization.

## Acceptance Criteria

check script uses parallel flags; CI/local doc mentions DENO_JOBS; no intentional serial bottleneck left without comment; flaky parallel run addressed or ticketed.

