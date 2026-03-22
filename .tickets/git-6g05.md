---
id: git-6g05
status: closed
deps: [git-9btr]
links: []
created: 2026-03-22T00:21:38Z
type: task
priority: 1
assignee: user.email
parent: git-zbfq
---
# Author specs/MCP.md; retire root MCP.md as normative source

Create specs/MCP.md as the top of the product-truth hierarchy for MCP (not a quick agent cheat sheet): rewrite from scratch for abstract contracts—tools, sessions, transports parity through shared core, auth/error shapes at the level appropriate to this layer. Agent-facing progressive discovery should rely on MCP tool descriptions and runtime behavior, not this file. Replace root MCP.md: remove normative content there (delete file or replace with a short non-normative pointer to specs/MCP.md per repo convention) and update **in-repo references** (AGENTS.md, README(s), lib comments, reference clients, remaining docs not deleted by **git-46zo**) to the new path. **Coordination:** **git-9btr** may touch AGENTS.md for the mandate link—sequence or merge to avoid thrash. **Root README:** prefer **minimal** MCP pointer fixes here; full orientation is **git-mpl2**. **git-46zo** deletes `docs/MCP_TEST_REMOTE_MOCKING.md`; prefer not to spend deep edits on files slated for deletion—update or drop links as appropriate. Initial pass: strict coverage of topics implied by tests/mcp/* plus transport/session/tool semantics that belong in this slice. Keep length ~2 pages; overlap with other specs minimal and non-contradictory. **Canonical pin / pin_set decision-tree** merge is **git-46zo** if the chosen home is specs/MCP.md.

## Acceptance Criteria

specs/MCP.md exists, is canonical for MCP product behavior, and **does not** cite root instruction/onboarding filenames as hooks; root MCP.md no longer competes as normative; **in-repo** pointer updates completed as in description (may touch AGENTS/README/etc. as mechanical link fixes—that is not the same as embedding those names inside **specs/MCP.md** body); strict coverage vs tests/mcp themes.

