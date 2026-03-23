---
id: git-vv7p
status: closed
deps: []
links: []
created: 2026-03-23T05:12:32Z
type: task
priority: 2
assignee: user.email
parent: git-vqsn
---
# Refresh tests/README MCP/pin spec pointers

MCP test mode subsection still says normative detail lives in specs/MCP.md and specs/core.md only; pin bootstrap and pin_set integration paths are now also specified under specs/pin-semantics.md. Update prose (and any tables) so harness authors see the three-way split: MCP transport/config, core session layout, pin-semantics for pin_set. Re-read specs/MCP.md memsearch startup rules vs tests/README harness subsection to ensure no contradictory wording.

## Acceptance Criteria

tests/README.md explicitly references specs/pin-semantics.md where pin_set/pin bootstrap behavior is relevant to integration setup (including the MCP test mode subsection and, if justified, the spec anchoring table row for `tests/mcp/`). Spot-check: no sentence implies harness rules override specs/MCP.md normative startup. Verifier evidence: name concrete files reviewed (`tests/README.md`, `specs/MCP.md`, `specs/pin-semantics.md`, `specs/core.md` as applicable).

