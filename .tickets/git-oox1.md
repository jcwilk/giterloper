---
id: git-oox1
status: open
deps: [git-9btr, git-46zo]
links: []
created: 2026-03-22T00:21:44Z
type: task
priority: 2
assignee: user.email
parent: git-zbfq
---
# Update tests/README.md for strict spec anchoring

**Scope:** Under **`tests/`**—this is part of the **structured** tickets/specs/tests/code workflow (see **git-zbfq**), **not** root-level onboarding docs.

**Deps:** **git-9btr** + **git-46zo** (implies **git-6uc2**, **git-e4x6**, **git-6g05** are done). Slimmer graph than listing each spec ticket separately.

Document folder pairing **tests/cli↔specs/cli.md**, **tests/core↔specs/core.md**, **tests/mcp↔specs/MCP.md**; tests strengthen **coded behavior ↔ spec constraints**; **strict:** no **product-behavior** tests without spec representation; initial rollout requires every current **product** test theme in those folders mirrored in the matching spec. **Harness/helpers:** `tests/helpers` and pure harness tests—define home explicitly (e.g. documented in this README + conventions, **or** one short “test infra” subsection in **specs/core.md** if chosen—pick one approach and state it; avoid literal “every line of every test maps to a spec bullet” misread). Mention **hierarchical alignment:** group spec/test/code commits deliberately when touching the same behavior.

**Handoff with git-46zo:** **46zo** may perform repo-wide link hygiene for removed `docs/*` paths; **git-oox1** owns the **substantive** testing-guide rewrite (model + harness + anchoring). Run after **46zo** (or same integration window) so you do not fight duplicate edits.

**Non-regression:** Preserve (or restate) harness docs: `tests/test-case-manifest.json`, `deno task gen:test-manifest`, `DENO_JOBS`, bounded worker pool, `tests/helpers` / isolation rules—when `docs/TEST_PARALLELISM_PLAN.md` is deleted, **inline or repoint** any unique content here rather than dropping it.

## Acceptance Criteria

tests/README.md matches new model; strict anchoring for **product** tests clear; harness scope explicit; no stale pointers to removed docs; harness/manifest/DENO_JOBS content not regressed; **git-incv** (later) must cite/align with this README’s harness + anchoring story (oox1 precedes incv in the DAG).

