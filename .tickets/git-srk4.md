---
id: git-srk4
status: closed
deps: [git-kms9]
links: []
created: 2026-03-24T02:22:14Z
type: chore
priority: 1
assignee: user.email
parent: git-shfx
---
# Decouple generic instruction examples from real spec paths

Sweep **`.cursor/skills/`**, **`.cursor/agents/`** (except as noted), **`CONVENTIONS.md`**, and other contributor-facing docs for **process-oriented** prose that uses **multiple real `specs/*.md` paths** as stand-ins for “any related normative doc” or generic rules. Replace with placeholders (`specs/<slice>.md`), “governing area spec(s) under `specs/`,” or pointers to **`tests/README.md`** pairing / mandate.

**Must-fix (known stale):** `.cursor/skills/file-tickets/SKILL.md` step 1; `.cursor/agents/work-next.md` precedence “for example …” real spec paths (if still present after `git-kms9`).

**Scope boundaries**
- **`git-kms9` owns** `AGENTS.md` meta-rule and mandate illustrative cleanup—**do not re-edit** those same paragraphs here except to fix breakage after kms9 lands.
- **`git-c2km` owns** adding/updating **verifier** and **tests/README** slice **tables** (concrete spec ↔ test folder rows). **`git-srk4`:** in `verifier.md` / `work-next.md`, only fix **generic instructional** “for example” enumerations—not replace normative routing tables.

**Carve-out:** **Normative** pairing tables (`tests/README.md`, verifier “read at minimum” table) **stay concrete**; this ticket targets **generic** instructional laundry lists, not contract indexes.

**`CONVENTIONS.md`:** verify once; expect **no** change unless a real hit appears.

## Acceptance Criteria

- Close note or PR lists **touched files**.
- **file-tickets** SKILL step 1 uses **no** embedded real pin-semantics (or other) spec path as a generic filing example.
- **Existing** bad patterns in scoped dirs addressed (not only “no new” regressions): at minimum **file-tickets** + **work-next** if still applicable.
- Spot-check: search `.cursor/` for illustrative **“for example”** (or equivalent) prose adjacent to multiple literal `specs/…md` paths in **non-table** body text—should be gone or placeholder-based.

## Notes

**2026-03-24T02:40:04Z**

Closure: decoupled generic spec examples from concrete paths. Touched: .cursor/skills/file-tickets/SKILL.md, .cursor/agents/work-next.md. CONVENTIONS.md unchanged. verifier.md unchanged (normative table carve-out).
