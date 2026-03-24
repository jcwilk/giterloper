---
id: git-c2km
status: open
deps: [git-srk4]
links: []
created: 2026-03-24T02:22:16Z
type: task
priority: 2
assignee: user.email
parent: git-shfx
---
# Harness: tests/pin-semantics slice, README, deno task, spec intro

**Split with `git-ewer`:** This ticket **creates** `tests/pin-semantics/`, wires **deno.json** `test:pin-semantics`, updates **harness-facing docs** and **verifier** so a **fourth** product-behavior tree is first-class. **`git-ewer`** populates / moves substantive pin-law tests and lib citations—do not block c2km on full extraction.

**Implement**
- **`tests/README.md`:** §1 currently limits product-behavior tests to `tests/core/`, `tests/cli/`, `tests/mcp/`—extend to **`tests/pin-semantics/`** and add pairing row **`tests/pin-semantics/` → `specs/pin-semantics.md`**. Clarify **`tests/mcp/`** primary pairing **`specs/MCP.md`** and that **pin matrix / `giterloper_pin_set` law** is normatively defined in **`specs/pin-semantics.md`** (MCP defers). **Decide and document** whether **`tests/core/`** row still lists **`specs/pin-semantics.md`** or only **`specs/core.md`** after the split (avoid duplicate authority without a one-line rule).
- **Runner bullets:** Any line that says **`DENO_JOBS`** applies only to `tests/core|cli|mcp` must match **reality** (discovery already recurses all `tests/**/*.test.ts`)—prefer wording like “all discovered cases under `tests/`” or explicitly include **`tests/pin-semantics/`**.
- **`deno.json`:** add `test:pin-semantics` mirroring `test:core`.
- **Root `README.md`:** if it lists topic-only tasks, add **`test:pin-semantics`** alongside core/cli/mcp.
- **`specs/pin-semantics.md`:** task-scoped opening paragraph—primary executable **pin-law** coverage under **`tests/pin-semantics/`** (not only `tests/core/`).
- **`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`:** if any example still says pin-semantics is exercised **only** under `tests/core/`, update to match the new tree (same commit as this ticket unless user defers).
- **`.cursor/agents/verifier.md`:** update **both** the “read at minimum” table **and** any **strict anchoring** prose that claims product-behavior tests exist **only** under three directories—add **`tests/pin-semantics/`** and **`specs/pin-semantics.md`** where pin-law / `pin_set` tests live.
- **`AGENTS.md`:** testing strategy / project structure bullets that enumerate only three test subtrees—add **`tests/pin-semantics/`**. **Coordinate** with `git-kms9` to reduce merge conflict (sequential edits or single assignee).
- **`scripts/run-tests.ts` / `discover-test-cases.ts`:** confirm recursive discovery (expected: **no code change**).
- **Placeholder test:** If `deno test tests/pin-semantics/` requires at least one file, add a **minimal** one-case smoke `*.test.ts`; `git-ewer` may replace/expand—otherwise document that topic task is empty until ewer lands.

## Acceptance Criteria

- `tests/README.md` §1, pairing table, and runner/`DENO_JOBS` wording **consistent** with four trees and pin-semantics slice.
- `specs/pin-semantics.md` intro matches **`tests/pin-semantics/`** as pin-law home.
- `deno task test:pin-semantics` runs successfully (non-empty or explicitly documented empty per placeholder rule above).
- `deno task test` discovers cases under `tests/pin-semantics/` when present.
- Verifier: **mandatory** update to slice table **and** strict three-folder anchoring paragraph—no leftover “only three” language.
- Mandate (if applicable) and root README topic tasks updated per design.
