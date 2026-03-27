---
id: git-cwzo
status: closed
deps: []
links: [git-pbau]
created: 2026-03-27T01:29:36Z
type: feature
priority: 1
assignee: user.email
parent: git-pbau
---
# Implement reconcile per specs/reconciliation.md (integration, atomicity, pairing)

**Parent epic:** `git-pbau`.

**Authoritative contract:** `specs/reconciliation.md`. Do not treat CLI/MCP prose as overriding it; **pair** user-visible strings with this slice after behavior matches the spec.

## Observed behavior (current code)

`lib/reconcile.ts`: topic-first pipeline—`extractTopic` (first `#` heading or basename stem), `groupByTopic`, one flat `knowledge/<topic>.md` per topic, `mergeTopicContent` concatenates bodies and appends `## Sources`. **No** LLM or equivalent agent-assisted step; **no** multi-file / subdirectory integration across the corpus; **no** incoming-wins **revision or removal** of conflicting existing corpus text (append-only merge). CLI help (`lib/gl.ts`, `cmdReconcile`) and MCP tool text (`lib/gl-mcp-server.ts`, `giterloper_reconcile_pending`) still describe grouping/“topic files” in terms of the old model—must be updated when behavior changes so they stay alignable with `specs/cli.md`, `specs/mcp.md`, and **`specs/reconciliation.md`**.

## Out of scope (this ticket)

- **`reconciliation_conflict`** (`specs/reconciliation.md` — **Errors: reconciliation_conflict**): normative code is **SHOULD** for when integration cannot complete for irreducible semantic reasons; optional follow-up unless blocking core MUSTs.
- Transport, auth, **`giterloper_merge`**—see `specs/mcp.md` and related; not this ticket’s focus.

## Direction (not prescriptive of vendor)

Replace or extend the reconcile pipeline so **substantive** behavior matches **`specs/reconciliation.md`**: an LLM **or** equivalent **agent-assisted** decomposition/placement per **Integration (decomposition and placement)**; corpus updates across **`knowledge/**/*.md`** as appropriate; **Conflict resolution (incoming knowledge wins)** applied to substantive disagreement; **Integration completeness and atomicity** (all-or-nothing publish, bail on failure without partial durable publish); **Ordering when multiple pending entries apply** (`addEpoch`); **Results, pin lifecycle, and structured fields** (parity CLI/MCP field names and semantics for full success). Update CLI and MCP strings in lockstep with behavior.

**Tests:** Adjust as needed (e.g. `tests/core/reconcile.test.ts`, `tests/cli/gl-write-ops.test.ts`, `tests/mcp/gl-mcp-workflow.test.ts`) so they assert spec-aligned behavior, not the legacy topic-file shortcut.

## Acceptance criteria (verifier-grade)

1. **Integration:** Processing pending uses agent-assisted decomposition/placement per **`specs/reconciliation.md` — Integration (decomposition and placement)**; integration is not satisfied solely by merging into single topic files keyed by heading/stem for the whole run.
2. **Conflict resolution:** When pending and existing corpus disagree on substance, incoming pending is authoritative; conflicting corpus passages are revised or removed per **Conflict resolution (incoming knowledge wins)**—not merely appended after stale text without resolution.
3. **Provenance, atomicity, ordering, results:** **`## Sources`**, **Integration completeness and atomicity**, **Ordering when multiple pending entries apply**, and **Results, pin lifecycle, and structured fields** behave per spec; **Non-goals** boundaries respected.
4. **Pairing:** `gl reconcile` help/usage and `giterloper_reconcile_pending` title/description align with **`specs/reconciliation.md`** and paired CLI/MCP slices (no orphaned “topic file” model if the product no longer uses it).
5. **Quality gate:** `deno task check` and `deno task test` pass; failure paths leave operators able to detect failure and avoid silent partial publish per spec.
