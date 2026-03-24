---
id: git-shfx
status: open
deps: []
links: []
created: 2026-03-24T02:22:09Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Pin-semantics test slice, citations, decoupled instruction examples

Follow-up to spec split (8511791). **User-directed:** normative spec/README/AGENTS edits in this epic are intentional alignment work, not agent-initiated “routine AGENTS churn.”

**Delivery order (child tickets):** `git-kms9` → `git-srk4` → `git-c2km` → `git-ewer` (linear deps).

**Scope:** (1) Root instructions: meta-rule for contrived examples without self-contradiction (`git-kms9`). (2) Sweep skills/agents/docs for generic “for example” laundry lists of real `specs/*.md` paths (`git-srk4`). (3) Harness and docs: fourth product-behavior tree `tests/pin-semantics/` paired with `specs/pin-semantics.md`, `tests/README.md` slice table + runner bullets, `deno.json` topic task, mandate/README/verifier/AGENTS alignment (`git-c2km`). (4) Move or split pin-law tests from `tests/core/` and `tests/mcp/` into `tests/pin-semantics/`; fix stale `specs/core.md` pin-configuration breadcrumbs and implementation comments; **incidental pin scenarios stay in MCP/CLI integration tests** (`git-ewer`).

**Clarification:** “README pairing” means **`tests/README.md`** (slice ↔ spec table and MCP deferral to pin-semantics), not necessarily the repo root README—update root README only if it still lists topic-only `deno task` slices incompletely.

## Epic acceptance

All children closed; `deno task test` and `deno task test:pin-semantics` green per `git-c2km` / `git-ewer` criteria.
