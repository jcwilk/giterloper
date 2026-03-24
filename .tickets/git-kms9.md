---
id: git-kms9
status: open
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

**Mandate:** In `HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`, replace **illustrative** parentheticals that enumerate real spec filenames (e.g. §1 area-spec example, §7 growth example) with placeholders **unless** the sentence is intentionally binding as written—goal is to stop teaching “random spec list = generic rule,” not to remove normative hierarchy text.

**Root README:** Onboarding links that **name a single artifact** (navigate to MCP spec, etc.) can stay concrete; do not expand them into multi-file “for example any spec” lists.

## Acceptance Criteria

- Meta-rule paragraph: no real `specs/<name>.md` inside **generic** exception/examples; self-consistent.
- **Where to read contracts** (and equivalent slice index) remains concrete and **semantically equivalent** after edits.
- Mandate: illustrative real-path laundry lists in §1 / §7 (and similar) generalized per design above; no **new** multi-file spec enumerations as generic process examples.
- Optional closure evidence: note files touched or one-line grep that the meta-rule exception clause does not contain a literal `specs/` markdown link to a real basename used only as illustration.
