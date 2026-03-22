---
id: git-kmr7
status: closed
deps: [git-6lq1]
links: []
created: 2026-03-22T02:43:33Z
type: feature
priority: 1
assignee: user.email
parent: git-amyx
---
# MCP: remove source from giterloper_pin_set; server-only repo identity

Normative: specs/core.md Surfaces table — MCP pin_set accepts only pin, ref, branch; **effective configured knowledge remote** (per **`mcpTestMode`**, **`specs/MCP.md`**) defines repo. Remove source from Zod schema, handlers, and any code paths that read client source for MCP.

## Design

Named pins created via MCP use the same configured remote as _session. Update MCP tool description strings to match specs (paired contract per AGENTS).

## Acceptance Criteria

Tool schema has no source field; unknown-field behavior unchanged. pin_set mutations resolve repo from server config only. CLI unchanged unless shared code requires careful factoring.

