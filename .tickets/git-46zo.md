---
id: git-46zo
status: open
deps: [git-6uc2, git-e4x6, git-6g05]
links: []
created: 2026-03-22T00:21:44Z
type: chore
priority: 1
assignee: user.email
parent: git-zbfq
---
# Migrate pin semantics docs into exactly ONE area spec; trim docs/

Consolidate all authoritative knowledge from docs/PIN_SETTING_PARAM_BEHAVIOR.md and docs/PIN_SET_CONTRACT.md into a single canonical location: exactly ONE of specs/cli.md, specs/core.md, or specs/MCP.md (choose based on best fit). The merged text must stay very explicit and unambiguous—especially the decision tree for how different invocations (CLI vs MCP, parameters, session pin vs named pins, ref/branch handling) are handled. Remove the old docs/*.md files after the spec contains the canonical content. DELETE deprecated docs/TEST_PARALLELISM_PLAN.md and docs/MCP_TEST_REMOTE_MOCKING.md. KEEP docs/DEPLOYMENT_REQUIREMENTS.md and docs/FLY_IO_DEPLOYMENT.md as general operational knowledge. Fix all repository references to moved/deleted paths (any ticket is fine as long as refs resolve).

## Acceptance Criteria

Pin contract lives in exactly one specs/*.md file; old pin docs removed; deprecated docs deleted; deployment docs retained; no broken internal links to removed paths.

