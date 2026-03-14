---
id: git-zrf2
status: open
deps: [git-mor9, git-dadj, git-6ens, git-j6xv, git-893e, git-fqhi, git-76vk, git-uw04, git-dsgd]
links: []
created: 2026-03-14T19:02:49Z
type: chore
priority: 2
assignee: user.email
parent: git-mowe
---
# Remove stale index references and align docs/scripts

Clean up stale references to nonexistent index/QMD commands and align repo docs/help/tests with the new MCP + memsearch implementation.

## Design

Update messaging in pinned/help/test helper comments and e2e runner cleanup logic so docs and scripts reflect actual supported commands and architecture. Explicitly remove references to nonexistent `gl-maintenance index`, QMD indexing assumptions, and `scripts/gl-extended` orphan cleanup hooks that are not present.

## Acceptance Criteria

- No stale references remain to nonexistent `gl-maintenance index`/QMD utilities.
- `README` and agent guidance mention MCP server and index isolation expectations accurately.
- Test helpers/comments are consistent with real command surface.
- `scripts/run-e2e.ts` no longer assumes missing `gl-extended` hooks.
- Documentation changes do not alter runtime behavior.
