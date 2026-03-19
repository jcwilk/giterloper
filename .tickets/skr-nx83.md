---
id: skr-nx83
status: in_progress
deps: []
links: []
created: 2026-03-19T20:46:15Z
type: chore
priority: 0
assignee: user.email
parent: skr-scn7
---
# Audit and update CLI help, MCP tool copy, and user-facing docs

First gate before encoding a truth hierarchy: bring all user-facing descriptions in line with actual behavior. Surfaces include but are not limited to: gl and gl-maintenance help/usage text, MCP tool titles and descriptions in lib/gl-mcp-server.ts (and any stdio entrypoint docs), README and docs that describe commands or tools, reference_client docs. Where behavior is specified in authoritative markdown (e.g. docs/PIN_SETTING_PARAM_BEHAVIOR.md, docs/MCP.md or MCP_API_CONTRACT if present), treat those specs as the target and fix drift in help/copy—not the reverse unless explicitly requested.

## Design

Prefer minimal wording changes that restore accuracy; avoid drive-by feature claims. Link each non-trivial correction to the spec or code path it reflects.

## Acceptance Criteria

Inventory of touched surfaces committed in ticket notes or checklist; obvious contradictions between listed help/MCP strings and cited canonical docs resolved or explicitly ticketed; spot-check: gl --help, one MCP tools/list payload, and README test section mention accurate commands/paths.


## Notes

**2026-03-19T20:54:18Z**

Surfaces touched (AC inventory): MCP.md (new, repo root) — parity, tools, errors, pointers to PIN_SETTING_PARAM_BEHAVIOR; lib/gl-mcp-server.ts — tool titles/descriptions + Zod pin param text aligned with reserved _session / merge omit rules; lib/gl-maintenance.ts — usage lines gl-maintenance not gl; lib/gl.ts — pin add --help semantics; README.md — pinned.yaml shape + MCP.md link; reference_client/README.md — pin_set row + MCP.md link; AGENTS.md — session pin wording + memsearch pointer to lib; lib/mcp-auth.ts, lib/memsearch-adapter.ts — doc refs. Spot-check: gl --help, README tests section, MCP tools/list via unit smoke (stdio).
