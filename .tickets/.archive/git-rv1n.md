---
id: git-rv1n
status: closed
deps: []
links: []
created: 2026-03-24T17:07:38Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Lean AGENTS.md and relocate misplaced detail

Cross-critique (4/4 lanes) agreed AGENTS.md mixes universal repo policy with product contracts, workflow catalogs, and implementation notes. Trim AGENTS to an efficient holistic entrypoint; move or delete content per child tickets. Governing intent: maintain pointers to HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md, specs/README.md, tests/README.md; avoid duplicate normative product law in AGENTS.

**Epic done when:** (1) **git-6m0f** adds external-retry contributor guidance to CONVENTIONS.md; (2) **git-7cxd** lands the lean AGENTS.md (including removal of External retries only after **git-6m0f** is closed—enforced by deps); (3) **git-61ko** adds low-churn repo layout nudges to tests/README.md. No remaining AGENTS text duplicates normative pin/MCP law that belongs only under `specs/*`; `./tk` invariants and verifier Task-spawn rule remain explicit in AGENTS.

**Child order (deps):** git-6m0f → git-7cxd → git-61ko.

