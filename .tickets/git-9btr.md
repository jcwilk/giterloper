---
id: git-9btr
status: open
deps: []
links: []
created: 2026-03-22T00:21:38Z
type: task
priority: 0
assignee: user.email
parent: git-zbfq
---
# Add HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md + prominent AGENTS.md link

Create root file HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md (name reflects multi-layer truth: root universal instructions vs per-area specs under specs/ vs tests vs code—not merely “the specs layer”). Document: (1) Orthogonality—root instruction files (AGENTS.md, CONVENTIONS.md, etc.) govern universal agent behavior, development process, and coding standards; area specs under specs/ govern product behavior for that slice only. If overlap appears, call it out; area specs should generally be adjusted to conform to repo-wide root instructions. Changing root instructions is reserved for systemic/process change requested by the user. (2) Precedence for product behavior within a slice: applicable specs/* > tests > implementation. docs/ operational notes are lowest: they may imply product behavior incidentally but never lock it—on conflict, update docs to conform. (3) Vocabulary: hierarchical alignment (specs, tests, code, and tickets/commits intentionally kept in sync) vs hierarchical divergence (drift)—agents should use commits to show joint intent (no changelog sections inside spec files; git history is the journal). (4) Duplication across area specs should be minimized; small overlap is acceptable but overlaps must not contradict—verifier flags conflicts aggressively. (5) Initial spec rollout: every topic exercised by tests in a folder must be represented in the matching area spec so the suite starts in strict alignment. (6) Ongoing rule: if behavior is not important enough for the spec, it should not get a test; if it deserves a test, it deserves a spec mention. Spec edits MUST only be made when tied to the current user/task scope—no drive-by spec edits. (7) ~2-page human skim target per area spec; if a topic domain outgrows that, prefer new specs/* file plus matching tests/ subtree when the task warrants expansion. AGENTS.md must link to this mandate prominently.

## Acceptance Criteria

HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md exists; AGENTS.md links to it prominently; content matches the above constraints (orthogonal root vs area specs, alignment/divergence terms, docs demotion, strict anchoring intent).

