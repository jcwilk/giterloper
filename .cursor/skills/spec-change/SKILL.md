---
name: spec-change
description: >-
  Human-driven spec edits under specs/*, optional alignment tickets for
  forward work only, verifier when tickets exist, persist. Use when the user
  says /spec-change or asks to change product specs and plan follow-ups.
---

# /spec-change — Human-directed specification updates

Execute this procedure **inline** in the current conversation (read this skill here; do **not** spawn a subagent for it).

**Purpose:** Apply requested edits under **`specs/*`** and, when the spec diff **creates or exposes** work still to be done elsewhere (tests, `lib/`, paired user-visible strings, `docs/` conformance), **plan that forward work** as tickets. This is **not** autopilot like **`work-next`**.

**Assumes** ticket **git-incv** semantics: when this flow **does** produce alignment tickets and bundles them with specs, **`verifier`** may treat the result as a **planning-shaped** commit. See **`.cursor/agents/verifier.md`**.

## Tickets: forward work only

- **File tickets** only for **remaining alignment or implementation** owed **after** the spec edit (e.g. update tests, code, CLI help, MCP strings, or operational docs to match a **new or tightened** contract).
- **Do not** file a ticket whose sole purpose is to **describe or commemorate** the spec edit you just made. **Git history** records what changed in **`specs/`**; tickets are for **dividing and conquering future work**, not change logs.
- If the human’s request is **purely reorganizational or clarifying** and **nothing** is owed in code/tests/docs, **skip filing**—commit the spec changes only (see **Persist** below).
- **Never** run **`./tk start`**, **`./tk close`**, or otherwise “complete” tickets as part of this flow. **spec-change** does not own ticket lifecycle; it only **creates** optional **planning** tickets for downstream agents.

## Out of scope (unless the human explicitly included them)

- **`AGENTS.md`**, root **`README.md`**, **`CONVENTIONS.md`**, and other root onboarding/instruction files—**do not** bundle into the default spec-change commit unless the human asked to change them **in this session**.
- **`lib/`**, **`tests/`**—never mix into the planning commit; they close under their own implementation tickets.

**`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`:** include **only** when the human **explicitly** asked to change it in this session; if in scope, stage it in the **same** commit as the related **`specs/`** (and any alignment tickets from this flow).

## Procedure

1. **Edit authoritative product specs**  
   Apply the human’s requested edits under **`specs/*`**. Uncommitted edits may sit in the tree while you assess step 2.

2. **Decide whether alignment tickets are needed**  
   From the **spec diff** and conversation, list **concrete forward work** (if any) that **`work-next`** or another agent would still need to do. If the list is empty, go to **step 5** (spec-only persist).

3. **File tickets (only when step 2 found work)**  
   Follow **`.cursor/skills/file-tickets/SKILL.md`** through **step 6** (pre-commit review). **Fused inputs** for filing and for read-only review subagents:  
   - the **conversation** and conclusion;  
   - the **current uncommitted diff** for every path to be bundled—**always** the **`specs/**`** that changed;  
   - **`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`** **if** step 1 touched it.  
   Each new ticket should describe **work not yet done**, not the spec edit already on disk.

4. **Single planning commit (when step 3 ran)**  
   Stage **all** uncommitted **`specs/`** paths that informed the filing **together with** the new or updated **`.tickets/*.md`**. **Do not** commit tickets alone while leaving those specs unstaged.  
   If the mandate was in scope, stage it in **this same** commit.  
   **Do not** mix **`lib/`**, server code, or **test** file changes into this commit.

5. **Verifier gate (only when step 3 produced tickets)**  
   Spawn the **`verifier`** subagent (**`.cursor/agents/verifier.md`**) against the **new/updated alignment tickets** and the **uncommitted** planning-shaped diff. If **REJECTED**, fix tickets/spec staging and re-run until **APPROVED**.  
   If **no** tickets were filed in step 3, **skip** verifier; go straight to **step 6**.

6. **Persist**  
   Use **`.cursor/skills/persist/SKILL.md`**: commit and push the staged set (specs-only, or specs + optional mandate, or specs + mandate + alignment tickets). Leave unrelated changes unstaged unless the human clarifies.

## Hard rules

- **Inline only** — this is a **skill**, not a Task **`subagent_type`**.
- **No ticket lifecycle** — no **start**/**close** for spec-change itself.
- **file-tickets** filing-only rules still apply; the **bundled planning commit** branch is **`.cursor/skills/file-tickets/SKILL.md`** step 7 (same commit as **`specs/*`**, optional mandate).
