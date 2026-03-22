---
id: git-46zo
status: closed
deps: [git-6uc2, git-e4x6, git-6g05]
links: []
created: 2026-03-22T00:21:44Z
type: chore
priority: 1
assignee: user.email
parent: git-zbfq
---
# Migrate pin semantics docs into exactly ONE area spec; trim docs/

Consolidate all authoritative knowledge from docs/PIN_SETTING_PARAM_BEHAVIOR.md and docs/PIN_SET_CONTRACT.md into a single canonical location: exactly ONE of specs/cli.md, specs/core.md, or specs/MCP.md (choose based on best fit). **Record the chosen file in the ticket close note** (or PR description) so “exactly one” is auditable. The merged text must stay very explicit and unambiguous—especially the decision tree for how different invocations (CLI vs MCP, parameters, session pin vs named pins, ref/branch handling) are handled. Non-chosen specs may add **short cross-links** only to the **chosen** area spec (e.g. `specs/core.md#…`)—**not** to root instruction files or stale `docs/PIN_*` paths after removal (no second normative copy). Remove the old pin docs after the spec contains the canonical content. DELETE deprecated docs/TEST_PARALLELISM_PLAN.md and docs/MCP_TEST_REMOTE_MOCKING.md. KEEP docs/DEPLOYMENT_REQUIREMENTS.md and docs/FLY_IO_DEPLOYMENT.md as general operational knowledge.

**Reference ownership (avoid double fixes):** This ticket owns **pin-doc paths**, **deprecated doc basenames**, and **repo-wide** broken links **from those removals/moves**. **git-6g05** owns root MCP.md → specs/MCP.md reference updates. **git-36ls** / **git-oox1** own substantive rewrites of AGENTS.md / tests/README.md—still, **verify** no stale pointers remain to removed paths (grep for old filenames and `docs/PIN_*`).

## Acceptance Criteria

Pin contract lives in exactly one specs/*.md file (named in close evidence); that file may exceed the usual ~2-page skim target **for the merged pin/decision-tree section** if needed for clarity; old pin docs removed; deprecated docs deleted; deployment docs retained; grep-clean for removed path strings / old basenames; no broken internal links to removed paths; coordination with sibling tickets respected per ownership note.

## Close evidence (canonical location — exactly one area spec)

**`specs/core.md`** — section **Pin configuration semantics** (HTML anchor **`#pin-configuration-semantics`**). Former `docs/PIN_SETTING_PARAM_BEHAVIOR.md` and `docs/PIN_SET_CONTRACT.md` merged there; `specs/cli.md` and `specs/MCP.md` link here only.
