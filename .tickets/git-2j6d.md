---
id: git-2j6d
status: open
deps: []
links: []
created: 2026-03-27T13:41:37Z
type: epic
priority: 2
assignee: user.email
---
# Epic: LLM-backed reconcile per specs/reconciliation.md

**specs/reconciliation.md** requires **LLM inference** for pending→corpus integration and forbids deterministic-only pipelines and successful non-LLM fallback. **lib/reconcile.ts** is still deterministic/heuristic—divergence from the contract.

## Children

| Ticket | Role |
|--------|------|
| **git-ehx5** | Implement LLM-backed reconciliation pipeline in code. |
| **git-1il6** | Tests, mocks, and CLI/MCP pairing (**specs/cli.md**, **specs/mcp.md**) after implementation lands. |

**Dependency rule:** **git-1il6** is blocked on **git-ehx5** (`./tk dep` / frontmatter). **git-ehx5** does not depend on this epic closing.

**Work-next:** Implement the **feature** tickets (**git-ehx5**, then **git-1il6**). This epic is a **container**—do not `./tk start` it for code changes; use the children.

## Closure

Close this epic when **git-ehx5** and **git-1il6** are both **closed**, `deno task check` and `deno task test` pass (environment per **tests/README.md**), and each child has received **verifier** **APPROVED** per its **Verifier scope** (below). **End-to-end** means those two scoped approvals **together** cover reconciliation plus CLI/MCP surfaces for reconcile—there is **no** separate epic-only verifier checklist beyond green checks and both child verdicts.

