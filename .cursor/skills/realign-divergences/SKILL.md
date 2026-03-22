---
name: realign-divergences
description: >-
  Compare observed behavior (conversation, logs, repros) to normative specs under
  specs/*; confirm drift; file alignment tickets, then run work-all to complete
  them. Use when the user says /realign-divergences or wants spec-vs-reality
  analysis turned into tracked fixes.
---

# /realign-divergences — Spec vs behavior, then tickets + drain

Execute **inline** in this conversation: read this skill here, then **read and follow** the linked skills at each phase. Do **not** collapse **`work-next`** or **`verifier`** into this thread—**`work-all`** owns delegation.

## Purpose

Mirror a disciplined **spec comparison** pass (like walking from “what we saw” → “what `specs/*` says” → “is that the same?”), then **persist** remediation as tickets and **drain** them via the repo’s batch workflow.

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

**Only if Phase 3 is “Divergence”** (or the user explicitly wants tickets for an **Ambiguous** item after choosing a direction).

1. Read and execute **`.cursor/skills/file-tickets/SKILL.md`** in full—including **pre-commit subagent review** and **commit/push** of **`.tickets/*.md`** only (no implementation in this phase).
2. Tickets MUST cite authoritative **`specs/*`** paths and include acceptance criteria **`work-next`** and **`verifier`** can use.
3. Structure work so **`./tk ready`** can progress (epic + children, **`./tk dep`** as needed, **`./tk dep cycle`** clean).

If **no** tickets end up created (e.g. user pulls back), **do not** run **`work-all`**.

## Phase 5 — Drain the queue

**Only after** Phase 4 produced **committed** tickets and the user did not abort filing.

1. Read and execute **`.cursor/skills/work-all/SKILL.md`**: for each **`./tk ready`** item, spawn **`work-next`** once; re-fetch **`./tk ready`** every iteration.
2. On **successful** drain per **`work-all`**, run the **Archive** block there (typically **`.cursor/skills/archive-tickets/SKILL.md`** with the **bundled approval** described in **`work-all`**).

If **`./tk ready`** is empty **before** any **`work-next`** completed (e.g. everything blocked on deps), **stop** after Phase 4 and report **blocked** tickets and missing deps—**do not** treat as a successful batch for archiving.

## Rules

- **Inline orchestration** — you read specs and compare here; **`work-next`** / **`verifier`** run inside delegated agents as defined elsewhere.
- **No drive-by spec edits** in this flow unless the user explicitly switched to **`/spec-change`** for a contract change.
- **Proportionality** — small divergences may be **one** focused ticket; large cross-cutting drift may warrant an **epic** with ordered children.
