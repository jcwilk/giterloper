---
id: git-r51w
status: closed
deps: [git-uqw4]
links: []
created: 2026-03-22T15:05:28Z
type: task
priority: 2
assignee: user.email
parent: git-x96q
---
# Tests and docs: require memsearch; remove optional search ignore

**Coordination:** Sibling **`git-hl4d`** covers **how to install** memsearch and baseline **PATH** prerequisites in **AGENTS.md** / **tests/README.md**. This ticket finishes **contract** alignment (MCP mandatory vs CLI optional per **specs/cli.md** / **specs/MCP.md**), removes test **ignore**, and updates **reference_client**; merge or sequence edits so **AGENTS** / **tests/README** do not fight **git-hl4d** (extend the install baseline rather than duplicating it).

Align tests and operator docs with specs/MCP.md executable-tests bullet: remove ignore:!hasMemsearch() from reference_client/tests/client.test.ts (search returns results always runs). Update reference_client/README.md and tests/README.md prerequisites so memsearch on PATH is required for suites that exercise search/MCP search. Update reference_client/run.ts messaging if needed. Update AGENTS.md and docs that call memsearch optional for dev/tests to match new contract (MCP mandatory; CLI startup still optional).

## Acceptance Criteria

No Deno.test marks search ignored for missing memsearch. README/AGENTS state MCP server and search tests need memsearch; CLI may omit memsearch at boot per specs/cli.md.

