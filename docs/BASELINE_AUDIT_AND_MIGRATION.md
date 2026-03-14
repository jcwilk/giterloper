# Baseline gap audit and migration checklist

This document audits the current CLI-only state against USE_CASES.md and the planned MCP architecture, and provides an explicit migration checklist for implementation tickets (spec/server/index). It identifies stale references, feature gaps, and sequencing constraints.

**Consumers:** git-1ua8 (MCP API contracts), git-mor9 (HTTP/SSE MCP server), git-dadj (memsearch adapter), git-zrf2 (stale reference cleanup), and related epic children.

---

## 1. USE_CASES capability → current status

| USE_CASES capability | Status | Notes |
|----------------------|--------|--------|
| **Giterloper as MCP server** (agents connect via MCP) | **Missing** | No MCP server; only CLI (`gl`, `gl-maintenance`) exists. |
| **Knowledge store** (private Git repo, Markdown files) | **Implemented** | Pins in `.giterloper/pinned.yaml`, clones under `.giterloper/versions/<name>/`, staged working clones for write ops. |
| **External agents push knowledge** (intake) | **Partial** | CLI `gl insert` queues content to `knowledge/_pending/` and pushes; no MCP tool for “insert pending”. |
| **External agents pull/query knowledge** (distribution) | **Missing** | No search or retrieve API. No version-pinned query surface for agents. |
| **Version-pinned queries** (per-commit SHA) | **Partial** | Pin+sha is tracked and used for clone/working dir; no query layer that accepts “pin + sha” and returns content. |
| **Centralized indexing and search** | **Missing** | No index pipeline. Memsearch adapter (git-dadj) and per-version isolation not implemented. QMD/orphan cleanup referenced in scripts but `gl-extended` does not exist. |
| **Reconciliation** (integrate new material, restructure) | **Partial** | `gl merge` and branch workflows exist; USE_CASES “reconciliation” may imply more (e.g. MCP reconcile tool, automated restructuring). |
| **State IDs** (commit SHA for resumption/comparison) | **Implemented** | Pin stores `sha`; insert/merge/promote update pin sha; no MCP response shape yet. |
| **Access control / auth** | **Missing** | Out of scope for current CLI; to be defined for MCP. |

---

## 2. Current command surface

**Main CLI (`gl`):**

- `diagnostic` — verify pin/clone health and branch freshness.
- `pin list | add | remove | update | load` — list, add, remove, update SHA, or load (clone without adding) pins.
- `insert` — read stdin, write to `knowledge/_pending/` in working clone, commit and push, update pin sha.
- `install-remote` — install remote for a pin’s source.
- `merge` — merge source pin’s branch into target pin’s branch via GitHub merge API.

**Maintenance CLI (`gl-maintenance`):**

- `status`, `verify`, `clone`, `teardown`, `stage`, `stage-cleanup`, `promote`.

There is **no** `gl-maintenance index` and **no** `gl-maintenance gpu`; references to these in code or comments are stale.

---

## 3. Stale references and cleanup targets

Enumerated with file paths for use by git-zrf2 and implementation work.

| Location | Issue | Suggested change |
|----------|--------|-------------------|
| **lib/pinned.ts** | `ensureGiterloperRoot()` error message mentions `"gl-maintenance clone" and "gl-maintenance index"`. | Remove “and \`gl-maintenance index\`”; only `gl-maintenance clone` exists. Optionally reword “auto-clones/indexes” to “auto-clones” until an index command exists. |
| **tests/helpers/gl.ts** | Comment lists `runGlMaintenance` as supporting “status, verify, clone, index, stage, stage-cleanup, teardown, gpu”. | Update to actual commands: `status`, `verify`, `clone`, `teardown`, `stage`, `stage-cleanup`, `promote` (no `index`, no `gpu`). |
| **scripts/run-e2e.ts** | Comment “QMD uses --index per pin+SHA (pinQmd) for isolation” and call to `glExtended` (`scripts/gl-extended`) with `qmd-orphan-cleanup`. | Remove or replace with comment describing actual e2e behavior (no QMD). Remove invocation of nonexistent `scripts/gl-extended`; keep only `cleanupLeakedTestPins()` or equivalent that uses existing `gl` commands. |
| **.gitignore** | `.giterloper/qmd/` | Retain only if QMD is planned; otherwise remove when index implementation is decided (e.g. memsearch path). |

No other stale references were found in `lib/pinned.ts`, `tests/helpers/gl.ts`, or `scripts/run-e2e.ts` beyond the above.

---

## 4. Migration checklist (code paths and sequencing)

Implementation tickets should use this ordering where dependencies exist.

1. **Stale reference cleanup (git-zrf2)**  
   - Update **lib/pinned.ts** error message (remove `gl-maintenance index`, align “auto-clones” wording).  
   - Update **tests/helpers/gl.ts** comment to list real gl-maintenance commands.  
   - Update **scripts/run-e2e.ts**: remove QMD comment and `gl-extended` call; rely on existing gl pin list/remove for cleanup.  
   - Can proceed in parallel with or before MCP/memsearch work; unblocks clear docs and test expectations.

2. **MCP API contracts (git-1ua8)**  
   - Depends on this audit (git-cu4d).  
   - Spec: **docs/MCP_API_CONTRACT.md** — tool-level schema (search, retrieve, insert pending, reconcile, state inspection), state-id semantics, error cases.  
   - Referenced by server and client implementation tickets.

3. **Memsearch adapter with pin+sha isolation (git-dadj)**  
   - Index manager keyed by (pinName, sha); no cross-version index use.  
   - Document runtime boundary (e.g. subprocess or service) for Deno.  
   - Required before MCP search/retrieve tools can be implemented correctly.

4. **HTTP/SSE MCP server runtime (git-mor9)**  
   - Implements the contract from git-1ua8.  
   - Depends on memsearch (git-dadj) for search/retrieve; may depend on reconciliation semantics.

5. **Reconciliation and MCP write path**  
   - Clarify “reconciliation” vs current `gl merge` and `gl insert`; add MCP tools for insert-pending and reconcile as per contract.  
   - After server runtime and memsearch are in place.

6. **E2E and docs**  
   - E2E coverage against `github.com/jcwilk/giterloper_test_knowledge` (already in use); add MCP/server E2E when server exists.  
   - README and AGENTS.md: mention MCP server and index isolation once implementation exists; align with git-zrf2.

---

## 5. Summary

- **Implemented:** Knowledge store (pins, clones, staged dirs), state IDs (pin sha), CLI insert/merge and maintenance commands.  
- **Missing:** MCP server, version-pinned search/retrieve, centralized indexing (memsearch pipeline), MCP-facing reconciliation and access control.  
- **Stale:** References to `gl-maintenance index`, “gpu”, QMD, and `scripts/gl-extended` in lib/pinned.ts, tests/helpers/gl.ts, and scripts/run-e2e.ts; fix in git-zrf2 or as part of implementation.  
- **Sequencing:** Cleanup stale refs and define MCP contract first; then memsearch adapter, then MCP server and reconciliation/write path; then E2E and doc updates.
