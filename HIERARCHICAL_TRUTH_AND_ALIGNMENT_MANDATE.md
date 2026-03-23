# Hierarchical truth and alignment mandate

This document defines how **layers of truth** relate in this repository: universal instructions at the repo root, **product-behavior specs** under `specs/` (one slice per area), **tests**, **implementation**, and **operational or descriptive notes** under `docs/`. It complements—not replaces—progressive reading lists and nudges in [AGENTS.md](./AGENTS.md).

---

## Why this hierarchy exists

Automated agents can produce far more code and churn than a solo maintainer can line-by-line review. **`specs/*`** is intentionally the **small, human-edited control surface**: the maintainer concentrates rigor there; agents and workflows align **tests** and **implementation** upward to match. Without a narrow, high-precedence normative layer, small divergences at lower layers accumulate faster than a human can steer the product back to intent. The hierarchy exists so **human intent stays legible and authoritative** while lower layers may drift temporarily but remain **repairable** against that intent.

---

## 1. Orthogonality: root instructions vs area specs

**Root instruction files** (for example [AGENTS.md](./AGENTS.md), [CONVENTIONS.md](./CONVENTIONS.md), and similar top-level guidance) govern **universal** agent behavior, development process, and coding standards for the whole repo.

**Area specs** under `specs/` govern **product behavior** for that slice only (for example `specs/core.md` for behavior exercised by `tests/core/`, and `specs/pin-semantics.md` for cross-cutting pin / `pin_set` rules referenced from multiple slices).

If these layers appear to overlap, **call the overlap out explicitly**. In general, **area specs should be adjusted to conform to repo-wide root instructions**, not the other way around. **Changing root instructions** is reserved for **systemic or process change** requested by the user—not for routine product tweaks.

---

## 2. Precedence within a product slice

For **product behavior** in an area, when sources conflict, use this order (highest wins first):

1. **Applicable documents under `specs/*`** for that slice  
2. **Tests** (executable checks; they do not override normative specs)  
3. **Current implementation** (code may drift; align it upward)

**Repair:** When **product behavior** disagrees across these layers, bring **implementation** and **tests** in line with the applicable **area spec**—unless the human is **intentionally** changing the contract, in which case update the spec and its dependents together in a deliberate change set.

**`docs/`** contains **operational notes**, deployment guidance, and **descriptive** product context (for example vision and use-case narratives). Those documents may **incidentally** describe product behavior but **must not lock** it. On conflict between `docs/` and `specs/`, **tests**, or intentional product contracts elsewhere, **update `docs/` to conform**—do not treat `docs/` as overruling area specs or tests for product truth.

---

## 3. Alignment, divergence, and history

- **Hierarchical alignment** means **specs, tests, code, and tickets/commits** are **intentionally kept in sync** for a slice: the same intent is visible across layers.
- **Hierarchical divergence** is **drift**—when layers disagree without an explicit, tracked decision to change.

Agents should use **commits** (and ticket linkage where applicable) to show **joint intent** across spec, test, and code changes. **Do not add changelog sections inside spec files**; **git history is the journal** for how normative text evolved.

---

## 4. Duplication and contradictions across area specs

**Duplication across `specs/*` files should be minimized.** Small, intentional overlap is acceptable when it aids reading, but **overlapping claims must not contradict** one another.

**Verifier responsibility:** verification should **flag conflicting product claims between `specs/*` documents**. This is **not** a mandate to treat root instruction files as spec checklists or to require the verifier to review every root doc as normative product text.

---

## 5. Initial spec rollout and test folders

**Strict alignment at rollout:** every **topic or behavior exercised by tests** in a given test folder (for example `tests/core/`, `tests/cli/`, `tests/mcp/`) **must be represented** in the **matching area spec** under `specs/` so the suite starts in **strict alignment** with written product truth.

---

## 6. Ongoing rules: tests, specs, and scope

- If behavior is **not important enough** to mention in the area spec, it **should not** get a dedicated test that encodes that behavior as contract.
- If behavior **deserves a test** as part of the product contract, it **deserves a mention** in the relevant area spec—meaning **contract-relevant** behavior (the rule, error shape, or scenario the test proves), **not** a prose echo of every test title or assertion. Judgement applies: the spec is **not** a test index; avoid fluff that merely mirrors the suite.

**Spec edits MUST only be made when tied to the current user or task scope.** No **drive-by** spec edits unrelated to the work at hand.

---

## 7. Size and growth of area specs

Target roughly **two pages** of comfortable **human skim** per area spec. If a topic domain **outgrows** that, prefer **a new file under `specs/`** plus a **matching subtree under `tests/`** when the task warrants that expansion—rather than unbounded growth of a single spec file.

---

## Summary

| Layer | Role |
|--------|------|
| Root instructions (`AGENTS.md`, `CONVENTIONS.md`, …) | Universal process and standards |
| `specs/*` | **Human-authored** normative product behavior per area—the **narrow control surface** agents align to |
| Tests | Executable checks; below specs for product truth |
| Code | Lowest; implement specs and passing tests |
| `docs/` | Operational and supporting notes, and non-normative product context; lowest for locking product behavior |

Together, these rules keep **hierarchical alignment** explicit and **divergence** visible and correctable.
