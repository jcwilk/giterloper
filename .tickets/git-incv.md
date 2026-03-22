---
id: git-incv
status: open
deps: [git-6uc2, git-e4x6, git-6g05, git-36ls]
links: []
created: 2026-03-22T00:21:49Z
type: task
priority: 2
assignee: user.email
parent: git-zbfq
---
# Extend .cursor/agents/verifier.md for hierarchy, orthogonality, and strict anchoring

Update verifier instructions: mandatory consultation of specs/cli.md, specs/core.md, specs/MCP.md for changes in those slices. Reject hierarchical divergence—changes must not conflict with applicable spec text. Root instruction files outrank area specs on overlap except when the user explicitly drives a systemic process change (then specs follow updated root). Flag contradictions between area specs when both apply; treat overlap as allowed only if consistent. docs/ lowest—never let stale docs justify rejecting spec-aligned code; instead require docs updates. Strict: reject tests that assert behavior with no spec anchor; reject new materially new behavior (agent judgement + repository precedence) lacking spec representation. Conceptual read-only: verifier verifies and reports, does not fix—running tests/commands is fine. Encourage optional sleuthing: nearby git history, spec diffs or excerpts in tickets when present—tickets need not explicitly map spec deltas. When judging plan-only commits (spec edits + new tickets, no code), treat well-formed tickets as valid alignment artifacts comparable to immediate code/test diffs for that verification pass—assess whether the ticket set plausibly covers the spec change intent.

## Acceptance Criteria

verifier.md updated; vocabulary and rules above reflected; still no self-directed fixes beyond verification reporting.

