---
id: git-kms9
status: closed
deps: []
links: []
created: 2026-03-24T02:22:12Z
type: chore
priority: 1
assignee: user.email
parent: git-shfx
---
# Root instructions: contrived-only meta-rule for examples

Fix AGENTS.md (and any root README/mandate instructional prose) so the 'Examples in instruction text' guidance does not violate itself: the meta-rule paragraph must use only placeholders for generic illustrations—no real `specs/*.md` filenames in **generic** “for example” / exception illustrations (point readers to the dedicated **Where to read contracts** / slice bullets below instead). **Keep** concrete paths in **dedicated contract-index bullets** (navigational “read this file for this slice”)—unchanged in meaning.

**Mandate:** In `HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`, replace **illustrative** parentheticals that enumerate real spec filenames (e.g. §7 growth example) with placeholders **unless** the sentence is intentionally binding as written—goal is to stop teaching “random spec list = generic rule,” not to remove normative hierarchy text.

**Handoff with `git-c2km`:** §1’s pairing of **`specs/pin-semantics.md`** to **`tests/core/`** is **factual layout**, not a generic “for example” list—it must be corrected when the four-tree layout lands (**c2km**). **`git-kms9`** should not leave §1 in a placeholder state that omits the real **`tests/pin-semantics/`** pairing unless **c2km** lands in the same series immediately after; prefer **kms9** generalize only the **multi-spec filename laundry-list** pattern in §1/§7, and **c2km** update the **`tests/core/` / `tests/pin-semantics/`** binding explicitly.

**Root README:** Onboarding links that **name a single artifact** (navigate to MCP spec, etc.) can stay concrete; do not expand them into multi-file “for example any spec” lists.

## Acceptance Criteria

- Meta-rule paragraph: no real `specs/<name>.md` inside **generic** exception/examples; self-consistent.
- **Where to read contracts** (and equivalent slice index) remains concrete and **semantically equivalent** after edits.
- Mandate: illustrative real-path laundry lists in **§7** (and similar non-binding examples) generalized per design above; **§1 test-folder ↔ spec binding** corrected under **`git-c2km`**, not left broken by placeholder-only edits here; no **new** multi-file spec enumerations as generic process examples.
- Optional closure evidence: note files touched or one-line grep that the meta-rule exception clause does not contain a literal `specs/` markdown link to a real basename used only as illustration.
