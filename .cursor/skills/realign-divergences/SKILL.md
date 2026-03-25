---
name: realign-divergences
description: Compare observed behavior to normative specs/*; confirm drift; delegate ticket filing to critique-and-refine (which follows file-tickets), then optionally drain via work-all. Use when the user says /realign-divergences or wants spec-vs-reality analysis turned into tracked fixes.
---

# /realign-divergences — Spec vs behavior, then tickets + drain

Execute **inline** in this conversation: read this skill, then follow linked skills **only** where this file points. **Phases 1–3** stay **in this thread** (same substance as before: governed by **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](../../../HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)**, **[AGENTS.md](../../../AGENTS.md)**, and the **`/spec-change`** stop rule in **`.cursor/skills/spec-change/SKILL.md`**). **Phase 4** is **Task** → **`critique-and-refine`**. **Phase 5** is **`work-all`**, which owns **`work-next`** / **`verifier`**—do not collapse those into this thread.

## Purpose

Walk **observation** → **normative `specs/*`** → **compare**, then **persist** alignment work as tickets (via delegated critique + filing) and **optionally** drain the queue.

## Truth precedence (do not skip)

Follow **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](../../../HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)** and **[AGENTS.md](../../../AGENTS.md)** source-of-truth order for the slice: **`specs/*`** (normative) → **tests** → **current code**.

- If **code or tests** disagree with an applicable **`specs/*`** contract, default assumption is **implementation or test drift**—tickets should **realign** those layers to the spec.
- If the user’s **intent** is to **change** the written contract, **stop** this flow for that item: use **`/spec-change`** (`.cursor/skills/spec-change/SKILL.md`) with **explicit** human direction; **do not** file tickets that encode silent spec rewrites.

## Phase 1 — Capture “what we are seeing”

From the **current request** and **conversation context** (and any logs, MCP/CLI output, test names, or repro steps the user implied):

1. State the **observed behavior** in concrete terms (what happened, in what surface: MCP, HTTP, CLI, tests, etc.).
2. Note **mode and inputs** that matter (env vars, transport, session id, flags)—anything that specs treat as normative.

If the target behavior is **vague**, narrow it with **one** round of clarification **or** a minimal repro **before** claiming divergence.

## Phase 2 — Find the normative contract

1. Identify the **product slice** (e.g. MCP, CLI, core pins).
2. **Search and read** the relevant **`specs/*.md`** sections (and **paired** user-visible contract text—CLI help, MCP tool descriptions—when the spec says they MUST stay in sync).
3. Quote or paraphrase the **minimum** normative text that applies (MUST / failure rules / ordering).

Use **`tests/README.md`** or **`tests/`** only as **secondary** evidence: tests **do not** override **`specs/*`**.

## Phase 3 — Compare and decide

| Outcome | Action |
|--------|--------|
| **Aligned** | Report match; cite spec + observation. **Stop**—no tickets, no **`work-all`**. |
| **Ambiguous** | Say what is unclear (missing spec, conflicting layers). Ask the user or propose a **`/spec-change`** clarification—**do not** invent a contract. |
| **Divergence** | Record a short **divergence statement**: spec says X; we see Y; affected area (file/surface). Proceed to Phase 4. |

## Phase 4 — File tickets (filing only)

**Only if** Phase 3 is **Divergence** (or the user explicitly wants tickets for an **Ambiguous** item after choosing a direction).

**Spawn** **`critique-and-refine`** via **Task** (`subagent_type: critique-and-refine`). **Do not** run **`.cursor/skills/file-tickets/SKILL.md`** **inline** in this thread for Phase 4—that procedure runs **inside** the subagent **after** **`.cursor/agents/critique-and-refine.md`** (draft bodies → cross-critique → integrate → **file-tickets**: epic/children, deps, pre-commit review, commit/push **`.tickets/*.md` only**).

The Task **`prompt` must be self-contained** (the subagent does not see this chat). Include at least:

- **Goal** / **Deliverable** / **Constraints** / **Starting point** per **`.cursor/agents/critique-and-refine.md`** (optional: `maxCritiqueRounds`, default **3**).
- **Deliverable:** require **commit and push** of the filing batch’s **`.tickets/*.md`** per **file-tickets** step **7** (unless the user explicitly waives commit/push or aborts)—so Phase 5’s **committed** gate is unambiguous (**critique-and-refine** otherwise defaults commit/push to **no**).
- **Constraints:** **`.cursor/skills/file-tickets/SKILL.md`** is **authoritative** for conclusions (treat **Starting point** as the “conversation conclusion”), epic/children, **`./tk dep`**, pre-commit review, and **tickets-only** commit/push; **no** implementation.
- **Starting point:** the **divergence statement(s)** and **spec citations** from Phases 1–3 (and any chosen direction for **Ambiguous** items).

Tickets MUST cite authoritative **`specs/*`** and include acceptance criteria **`work-next`** and **`verifier`** can use; keep **`./tk ready`** workable (epic + children, **`./tk dep`**, **`./tk dep cycle`** clean).

If **no** tickets are **created and committed**, **do not** run **`work-all`**.

## Phase 5 — Drain the queue

Invoke the /work-all skill

## Rules

- **Skills vs agents** — Do **not** open **`agents/*.md`** and run those workflows **inline** where this skill names a **Task** subagent.
- **No drive-by spec edits** unless the user explicitly switched to **`/spec-change`** for a contract change.
- **Proportionality** — one focused ticket vs **epic** + ordered children as the drift warrants.
