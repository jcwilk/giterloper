---
name: spec-change
description: Human-directed edits under specs/*; optional alignment tickets; verifier when tickets exist; persist. Task only—do not inline. Use for /spec-change or explicit product contract updates.
model: composer-2-fast
---

WHENEVER THIS WORKFLOW APPLIES, YOU **MUST** SPAWN **`spec-change`** VIA **Task** (`subagent_type: spec-change`). **Do not** run this procedure inline in the parent thread.

# spec-change — Human-directed specification updates

Orchestrate **human-directed** normative edits under **`specs/*`** by delegating revisable drafting to **`critique-and-refine`**, then optional alignment tickets, **verifier** (only if tickets exist), and **persist**. Precedence and pairing live in **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](../../HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)** and **[AGENTS.md](../../AGENTS.md)**—do not restate them here.

## Inputs (parent `Task` prompt)

- The user’s **spec-change request** and **conversation context** needed to carry it out.
- **Commit/push:** explicit yes/no; **default no** unless the user required landing changes this session (same default as the former inline skill).
- **You must** pass the same commit/push instruction through to **`critique-and-refine`** in its **Deliverable** section (that subagent defaults commit/push to **no** unless the brief says otherwise).

## Step A — Spawn `critique-and-refine`

**Task** → **`critique-and-refine`** (`subagent_type: critique-and-refine`) with a **self-contained** brief (the subagent does not see the parent chat). Minimum **Goal / Deliverable / Constraints / Starting point** per **`.cursor/agents/critique-and-refine.md`**.

The brief **must** encode this **procedure** (same substance as the historical inline **`/spec-change`** workflow):

1. **Draft and refine `specs/*`** — Cross-critique loop owns **spec text** until ready to proceed; apply the human’s requested edits under **`specs/`** (and see mandate rule below).
2. **Alignment tickets (optional)** — From the **spec diff** and conversation, list **concrete forward work** still owed (tests, code, CLI help, MCP strings, docs, etc.). If **empty**, skip filing; when persisting (per parent), commit **specs** (and optional mandate) only—**no** verifier for this path. If **non-empty**, follow **`.cursor/skills/file-tickets/SKILL.md`** through **step 6** (pre-commit review). **Fused inputs** for filing and review: conversation conclusion; **uncommitted diff** for every path to bundle—**always** changed **`specs/**`**; **`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`** **if** it was edited. Tickets describe **work not yet done**, not the spec edit already on disk. **Do not** file tickets that only commemorate the spec change. **Never** **`./tk start`**, **`./tk close`**, or otherwise complete tickets here.
3. **Stage the planning bundle (no `git commit` yet)** — When tickets were filed, **`git add`** **all** uncommitted **`specs/`** paths that informed filing **together with** the new/updated **`.tickets/*.md`** (and **`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`** if in scope) so they will land as **one** planning-shaped commit **when** **persist** runs. **Do not** leave tickets unstaged while specs stay unstaged. **Do not** stage **`lib/`**, **`tests/`**, or other implementation files. **Do not** run **`git commit`** before **verifier** (when tickets) and **persist**—verifier’s primary surface is **uncommitted** changes (staged counts as uncommitted until committed). When **no** tickets were filed, stage only what the parent authorized for persist (typically **`specs/**`** ± mandate).
4. **`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`** — Edit or stage **only** if the human **explicitly** asked to change it this session; if in scope, include it in the **same** persist commit as the related **`specs/`** (and alignment tickets from this flow).
5. **Out of scope** unless the human explicitly included them this session: **`AGENTS.md`**, root **`README.md`**, **`CONVENTIONS.md`**, and other root onboarding/instruction files—**do not** bundle into the default planning commit.
6. **Verifier** — **Spawn** **`verifier`** (`subagent_type: verifier`) **only** when alignment tickets were created: evaluate **new/updated tickets** and the **uncommitted** planning-shaped diff (staged and unstaged). On **REJECTED**, fix tickets/staging and re-run until **APPROVED**. **Skip** if no tickets. When specs and alignment tickets bundle together, **`verifier`** may treat the result as a **planning-shaped** change set—see **`.cursor/agents/verifier.md`** (**Plan-only and planning-shaped commits**).
7. **Persist** — **`.cursor/skills/persist/SKILL.md`**: **`git commit` / push** only here, per parent instruction (default **no**—if default applies, **skip** persist and leave work uncommitted unless the human clarified). Leave unrelated changes unstaged unless the human clarified. **Bundled planning** shape matches **file-tickets** step **7** (specs ± mandate + `.tickets/*.md` in **one** commit **after** gates above).

**Starting point:** Paste or point to the human request and any seed paths; optional **`maxCritiqueRounds`** for spec drafting (default **3**).

## Step B — Return to parent

Report **paths touched**, **ticket IDs** (if any), **commit/push status**, and give the parent an **explicit** instruction to run **`/realign-divergences`** **inline** in the **parent** thread (read **`.cursor/skills/realign-divergences/SKILL.md`**) so **code/tests** and the rest of the stack can be driven toward the updated **normative specs**. Do not duplicate **work-all** or downstream drain steps—**realign-divergences** already owns that optional path.

## Hard rules

- **Task-only** for **`spec-change`**—parents do not impersonate this file inline.
- **No ticket lifecycle** in this flow beyond **filing** (optional).
