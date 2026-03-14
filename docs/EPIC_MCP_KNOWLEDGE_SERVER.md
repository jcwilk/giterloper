# Epic: MCP knowledge server + per-version search (git-mowe)

Epic-level summary for the MCP knowledge server work. Ties children together and tracks progress. See USE_CASES.md for architecture and BASELINE_AUDIT_AND_MIGRATION.md for migration checklist.

---

## Goal

Implement the USE_CASES target architecture: giterloper as an HTTP/SSE MCP server that external agents use for version-pinned retrieval, pending-knowledge intake, and reconciliation, with memsearch-backed indexing isolated per pin+sha and a minimal external reference client. Include robust E2E coverage against github.com/jcwilk/giterloper_test_knowledge and eliminate stale index-related references in existing code/docs.

---

## Children and status

| Ticket | Title | Status | Notes |
|--------|-------|--------|-------|
| git-cu4d | Baseline gap audit and migration checklist | closed | Produced docs/BASELINE_AUDIT_AND_MIGRATION.md |
| git-1ua8 | Specify MCP API contracts and state semantics | closed | Produced docs/MCP_API_CONTRACT.md |
| git-dadj | Add memsearch adapter with strict pin+sha isolation | open | Index manager keyed by (pinName, sha) |
| git-mor9 | Implement HTTP/SSE MCP server runtime | open | Depends on git-1ua8, git-cu4d |
| git-6ens | Implement version-pinned MCP retrieval/search tools | open | giterloper_search, giterloper_retrieve |
| git-j6xv | Implement MCP intake tool for pending knowledge | open | giterloper_insert_pending |
| git-893e | Build rudimentary topic-first reconciliation workflow | open | Reconciliation semantics |
| git-dsgd | Add MCP authn/authz baseline and policy hooks | open | Auth for MCP server |
| git-fqhi | Create minimal external reference_client | open | Minimal MCP client for testing |
| git-76vk | Add isolation tests for per-version memsearch indexes | open | Tests for git-dadj |
| git-uw04 | Add MCP E2E workflow tests using test knowledge repo | open | E2E against giterloper_test_knowledge |
| git-zrf2 | Remove stale index references and align docs/scripts | open | Cleanup; depends on other children |

---

## Epic scope → child mapping

| Epic deliverable | Primary child(ren) |
|------------------|--------------------|
| MCP API contract | git-1ua8 (done) |
| Migration checklist | git-cu4d (done) |
| Per-version indexing | git-dadj, git-76vk |
| HTTP/SSE MCP server | git-mor9 |
| Version-pinned search/retrieve | git-6ens |
| Pending-knowledge intake | git-j6xv |
| Reconciliation | git-893e |
| Auth baseline | git-dsgd |
| Reference client | git-fqhi |
| E2E coverage | git-uw04 |
| Stale reference cleanup | git-zrf2 |

---

## Sequencing (from BASELINE_AUDIT_AND_MIGRATION.md)

1. **Stale refs (git-zrf2 partial scope)** — Per BASELINE_AUDIT: lib/pinned.ts, tests/helpers/gl.ts, scripts/run-e2e.ts cleanup can proceed in parallel; removes gl-maintenance index/QMD references. Full git-zrf2 (align docs with final impl) waits on other children.
2. **Memsearch adapter (git-dadj)** — Required before search/retrieve tools. Add isolation tests (git-76vk) in parallel or after.
3. **HTTP/SSE server (git-mor9)** — Implements MCP contract. Depends on memsearch for search/retrieve.
4. **MCP tools** — git-6ens (search/retrieve), git-j6xv (insert), git-893e (reconcile), git-dsgd (auth).
5. **Reference client (git-fqhi)** — Minimal client for validation.
6. **E2E (git-uw04)** — Workflow tests against test knowledge repo.
7. **Full cleanup (git-zrf2)** — Align docs/scripts with final implementation.

---

## References

- USE_CASES.md — Architecture and use cases
- docs/MCP_API_CONTRACT.md — MCP tool schemas, state semantics, error codes
- docs/BASELINE_AUDIT_AND_MIGRATION.md — Current state, gaps, migration checklist
