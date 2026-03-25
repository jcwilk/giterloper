---
name: cross-critique
description: Runs four parallel read-only Task lanes (Gemini, Claude, OpenAI, Composer) to critique an artifact or decision; the parent pastes a self-contained prompt (critics do not see the parent chat) and reconciles reports into prevalence- and impact-ranked findings. Use for /cross-critique or whenever you want multi-model depth on correctness, specs, design, or uncommitted changes.
---

# /cross-critique — Multi-model parallel critique

**Orchestration:** The **current** agent (parent) spawns **four** **Task** subagents **in one turn** (parallel). Each invocation sets **`readonly: true`**.

**Model identity:** Intended model ids for each lane live **only** in `.cursor/agents/cross-critique-*.md` frontmatter (`model`). This skill’s table lists **`subagent_type`** and **filenames** only—no duplicated model strings (avoids table vs frontmatter drift). **Do not** pass Task’s optional **`model`** argument to swap models for this workflow; use the four registered lane types as defined. **Cursor** must accept those **`subagent_type`** values and honor each lane’s definition (how frontmatter maps to the runtime model is **environment-specific**). If invocation fails or every lane feels identical, fix **project/Task registration** or lane files together—do not assume committed markdown alone guarantees behavior.

**Do not** impersonate the four critics inline—delegation is the point.

**When to use:** User says **`/cross-critique`**; you want **independent** critics before merging a spec change, shipping a sensitive code path, or locking a plan; sanity-checking a **thread conclusion** against `specs/*` and tests; reviewing **working-tree or branch diffs** for drift from the contract. **Not** for ticket hygiene—see **`AGENTS.md`** (critique is separate from `./tk` flows).

## Subagents (one parallel Task per lane)

Spawn exactly **four** Task subagents **in one parent message** (see **Partial lane failures** if fewer succeed). Use these **`agents`**:
* `cross-critique-gemini`
* `cross-critique-claude`
* `cross-critique-openai`
* `cross-critique-composer`

## If critique lanes are unavailable

If the subagents fail to complete for whatever reason:

1. **Stop** the turn.
2. **Tell the user** clearly that parallel critique lanes are not invocable in this session (quote the error if any).
3. **Optional human fallback:** the user runs separate critiques in other chats/models and pastes results back for the parent to reconcile—same clustering rules as below, with prevalence labeled **x/n** for however many real reports exist.
4. Do **not** claim success for `/cross-critique` unless **all** lanes successfully produced a report.

## What to put in each Task `prompt`

Use the **same** prompt body for **all** lanes you spawn. It MUST be **self-contained**: Task subagents do **not** see the parent conversation unless you paste it.

1. **Evaluation target** — What to critique (decision, design, diff summary, plan, spec excerpt, thread conclusion, etc.).
2. **Context pack** — Facts the critics need. **Minimum when the target is a concrete artifact:** include either **verbatim quoted text** (code, spec paragraph, ticket chunk) **or** an unambiguous **repo path** plus **revision** (commit SHA, branch, or “current workspace”) so critics can read the same bytes. Vague summaries alone often produce **agreement on noise**, not on the artifact.

**Example shape:**

```markdown
## Evaluation target
<EVALUATION_TARGET>

## Context (from parent)
<CONTEXT_PACK>
```

**Report rubric** (Executive read, Findings, Gaps, Critic lane, **END CRITIC REPORT**) is centralized in **[`lane-contract.md`](./lane-contract.md)**; lane agent files point critics there.

## Parent duties after all lanes return

1. **Read** all returned reports (do not cherry-pick one).
2. **Cluster** findings into themes (same underlying issue = one theme).
3. **Prevalence:** For each theme, note how many lanes raised it (**x/k** or **x/4**, per **Partial lane failures**). Treat strong agreement as higher signal unless clearly a shared misconception—if lanes disagree, say so explicitly.
4. **Impact:** When ranking, weight **high-impact** items **and** **widely reported** items toward the **top**. Place **low-impact** or **single-lane** nitpicks **lower** (still list them).
5. **Present to the user** using this **debrief format** (in order):
   - **Brief orientation** — Very short summary of overall results: whether the critique reads as mostly positive, negative, or mixed; whether critics converged on a dominant theme; anything notable about agreement vs disagreement.
   - **Ranked concerns** — Themes ordered by impact and prevalence (still note **x/k** or **x/4** where useful). Use **bullet points**, not a table. Each bullet should focus on **shortcomings, weaknesses, or concerns** (not a separate “what went well” list). When one theme needs extra detail (sub-bullets, edge cases), expand that bullet without forcing the same structure on every item.
   - **Conclusion** — One cohesive synthesis of what the evaluation implies for the target artifact or decision. Mention strengths **only in context** of the overall verdict (e.g. “the core approach is sound, but …”). If there are major flaws, do not give equal weight to minor positives. Aim for a **medium-sized paragraph**, or slightly longer only when nuance is decision-critical. The reader should be able to **act** on this conclusion.
   - Keep full per-lane prose **out of the debrief** unless the user asked for it; offer to paste individual reports if useful.

## Rules

- **Read-only critics** — no ticket closure, commits, or file writes from critique lanes.
- **Parallelism** — Prefer four Task calls in **one** parent message.
- **Proportionality** — If the user’s ask is trivial, shrink the context pack; still run all four lanes.
- **Repo norms** — For product behavior targets, reconciliation respects giterloper **spec → test → code** precedence (`AGENTS.md`).
