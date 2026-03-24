# Hierarchical truth and alignment mandate

This document defines how **layers of truth** relate in this repository: universal instructions at the repo root, **product-behavior specs** under `specs/` (one slice per area, sometimes more than one file per slice), **tests**, **implementation**, and **operational notes** under `docs/`. It complements—not replaces—progressive reading lists and nudges in [AGENTS.md](./AGENTS.md).

---

## Why this hierarchy exists

**Human bandwidth:** Automated agents can produce far more code and churn than a solo maintainer (or any small team) can review line by line. **Normative specs under `specs/`** are deliberately the **narrow, human-edited control surface**: the maintainer steers **intent** there; agents and workflows align **tests** and **implementation** beneath that layer.

**Drift:** Small divergences at the code or test layer are inevitable. Without a **single high-precedence** product contract that stays short enough to own, those divergences **accumulate** and pull the product in competing directions faster than a human can correct. The hierarchy makes **intent** visible at the top so **repair** has a clear target.

**This document** states **order**, **repair direction**, and **scope rules** for those layers. [AGENTS.md](./AGENTS.md) adds workflow (skills, agents, tickets) and points here for product truth—it should not replace this file’s hierarchy rules.

---

## 1. Orthogonality: root instructions vs area specs

**Root instruction files** (for example [AGENTS.md](./AGENTS.md), [CONVENTIONS.md](./CONVENTIONS.md), and similar top-level guidance) govern **universal** agent behavior, development process, and coding standards for the whole repo.

**Area specs** under `specs/` govern **product behavior** for that slice only. Topic test folders pair with those specs for **executable** alignment—for example a **`specs/<slice>.md`** (and matching **`tests/<topic>/`**) per product area (shared library and pins, CLI, MCP, …), with deferrals such as MCP → pin-law documented in **`tests/README.md`**. See **§5** for rollout pairing.

If these layers appear to overlap, **call the overlap out explicitly**. In general, **area specs should be adjusted to conform to repo-wide root instructions**, not the other way around. **Changing root instructions** is reserved for **systemic or process change** requested by the user—not for routine product tweaks.

---

## 2. Precedence within a product slice

For **product behavior** in an area, when sources conflict, use this order (highest wins first):

1. **Applicable documents under `specs/*`** for that slice  
2. **Tests** (executable checks; they do not override normative specs)  
3. **Current implementation** (code may drift; align it upward)

**`docs/`** contains **operational notes**, deployment guidance, **descriptive vision** (for example product use-case narratives), and similar material. Those documents may **incidentally** describe product behavior but **must not lock** it. On conflict between `docs/` and `specs/`, **tests**, or intentional product contracts elsewhere, **update `docs/` to conform**—do not treat `docs/` as overruling area specs or tests for product truth.

**Repair (product behavior):** When the applicable area spec, tests, and implementation disagree on **product behavior**, treat the area spec as authoritative **unless** the human is **intentionally** changing the contract. **Bring implementation and tests into alignment** with the spec (and any paired CLI help or MCP tool descriptions). Do **not** rewrite normative spec text to match failing tests or drifting code without **explicit human direction** to change the contract.

**Conflict resolution (examples):**

- Spec says X, test expects Y, code does Z → align **code and tests** to the spec (and paired user-visible strings); do not change the spec without the user.
- Test says X, code does Y, and nothing in (1) settles it → treat the test as the intended behavior for that gap; fix **code** (or the test if it is wrong—still without contradicting (1)).
- Two markdown docs disagree → the more **authoritative / behavior-normative** source wins (for example a “single source of truth” section in `specs/*` over informal notes); if unclear, ask the user before persisting.

**Required behavior for agents:**

- If tests conflict with (1), treat the tests as **stale** relative to the contract and update them (with implementation) to restore alignment with the normative specs.
- If code conflicts with tests and (1), align code to (1) first, then align tests to the same contract.
- Never file or execute work that moves behavior away from (1) unless the user **explicitly** requests that contract change.

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

**Strict alignment at rollout:** every **topic or behavior exercised by tests** in a given test folder (for example `tests/core/`, `tests/pin-semantics/`, `tests/cli/`, `tests/mcp/`) **must be represented** in the **matching area spec or specs** under `specs/` so the suite starts in **strict alignment** with written product truth. A slice may use **more than one** spec file (for example shared core behavior plus a dedicated pin contract); together they must cover what the paired tests encode as product law. **Pairing details** (including which folder owns **pin-law** vs **core library** coverage) are documented in **`tests/README.md`**.

---

## 6. Ongoing rules: tests, specs, and scope

- If behavior is **not important enough** to mention in the area spec, it **should not** get a dedicated test that encodes that behavior as contract.
- If behavior **deserves a test** as part of the product contract, it **deserves a mention** in the relevant area spec.

Here **“mention”** means the spec should record the **contract-relevant behavior or theme** (what a maintainer would need to know to steer the product)—**not** a mirror of every test case name, assertion, or scenario list. Judgement applies: the spec is **not** a prose index of the suite; avoid **padding** specs to echo tests one-for-one.

**Spec edits MUST only be made when tied to the current user or task scope.** No **drive-by** spec edits unrelated to the work at hand.

---

## 7. Size and growth of area specs

Target roughly **two pages** of comfortable **human skim** per area spec **file**. If a topic domain **outgrows** that, prefer **a new file under `specs/`** (for example splitting a large slice into **`specs/<slice-a>.md`** and **`specs/<slice-b>.md`**) plus a **matching subtree under `tests/`** when the task warrants that expansion—rather than unbounded growth of a single spec file.

---

## Summary

| Layer | Role |
|--------|------|
| Root instructions (`AGENTS.md`, `CONVENTIONS.md`, …) | Universal process and standards |
| `specs/*` | **Human-authored** normative product behavior per slice—the **control surface** agents align to; keep it lean |
| Tests | Executable checks; below specs for product truth |
| Code | Lowest; implement specs and passing tests |
| `docs/` | Operational notes, deployment, and **non-locking** narrative (vision, use cases); must not define product law |

Together, these rules keep **hierarchical alignment** explicit and **divergence** visible and correctable.
