---
id: git-cu4d
status: closed
deps: []
links: []
created: 2026-03-14T19:06:20Z
type: task
priority: 0
assignee: user.email
parent: git-mowe
---
# Baseline gap audit and migration checklist

Audit the current CLI-only state against USE_CASES and the planned MCP architecture, then publish an explicit migration checklist that identifies stale references, feature gaps, and sequencing constraints before implementation starts.

## Design

Document current command surface and missing capabilities (MCP server, memsearch index pipeline, reconciliation), plus known stale references in lib/pinned.ts, tests/helpers/gl.ts, and scripts/run-e2e.ts. Produce a checklist consumed by implementation tickets.

## Acceptance Criteria

- Audit document maps each `USE_CASES.md` capability to current status (implemented, missing, partial).
- Migration checklist identifies required code paths/modules and sequencing constraints.
- Stale references and cleanup targets are enumerated with file paths.
- Output is referenced by spec/server/index tickets.
