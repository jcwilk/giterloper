---
name: spec-change
description: Human-directed edits under specs/* via critique-and-refine; persist optional. Task only—do not inline. Use for /spec-change or explicit product contract updates.
model: composer-2-fast
---

WHENEVER THIS WORKFLOW APPLIES, YOU **MUST** SPAWN **`spec-change`** VIA **Task** (`subagent_type: spec-change`). **Do not** run this procedure inline in the parent thread.

# spec-change — Human-directed specification updates

**Scope:** Update **`specs/*`** (and **`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`** only if the human explicitly asked this session). **Do not** file tickets, stage **`.tickets/`**, edit **`lib/`**, or spawn **`verifier`** here—**`/realign-divergences`** (and optional **`work-all`**) owns bringing **code, tests, CLI/MCP strings, and tickets** in line with the new contract.

Precedence and pairing rules live in **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](../../HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)** and **[AGENTS.md](../../AGENTS.md)**—do not restate them here.

**Branches:** After commit/push, **stay on the working branch**. **Do not** merge into **`main`** (or fast-forward **`main`**) unless the parent’s Task prompt **explicitly** asks to merge to **`main`**—see **AGENTS.md** — **Git branches and `main` (default)**.

## Inputs (parent `Task` prompt)

- The user’s **spec-change request** and **conversation context** needed to carry it out.
- **Commit/push:** explicit yes/no; **default no** unless the user required landing changes this session.
- Pass the same commit/push instruction through to **`critique-and-refine`** in its **Deliverable** section (that subagent defaults commit/push to **no** unless the brief says otherwise).

## Step A — Spawn `critique-and-refine`

**Task** → **`critique-and-refine`** (`subagent_type: critique-and-refine`) with a **self-contained** brief (the subagent does not see the parent chat). Minimum **Goal / Deliverable / Constraints / Starting point** per **`.cursor/agents/critique-and-refine.md`**.

The brief **must** make **`specs/*`** (± mandate if in scope) the **only** writable deliverable: cross-critique until the spec text matches the human’s intent; **no** alignment tickets, **no** implementation file edits.

**Optional in the brief:** `maxCritiqueRounds` (default **3**).

## Step B — Return to parent

Report **paths touched** under **`specs/`** (and mandate if edited), **commit/push status**, and tell the parent to run **`/realign-divergences`** **inline** (read **`.cursor/skills/realign-divergences/SKILL.md`**) so the rest of the stack can follow the updated normative specs.

## Hard rules

- **Task-only** for **`spec-change`**—parents do not impersonate this file inline.
- **Specs-only** for this workflow—no **`.tickets/`**, **`verifier`**, or **`lib/`** in this agent.
- **No merge to `main`** here unless the user explicitly requested it in the parent prompt (**AGENTS.md** — **Git branches and `main` (default)**).
