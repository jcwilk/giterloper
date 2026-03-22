---
id: git-6uc2
status: open
deps: [git-9btr]
links: []
created: 2026-03-22T00:21:38Z
type: task
priority: 1
assignee: user.email
parent: git-zbfq
---
# Author specs/cli.md (strict coverage vs tests/cli)

Add specs/cli.md: concise (target ≤~2 pages), deduplicated natural language, unambiguous superset of product knowledge implied by **tests/cli/\*.test.ts** and CLI-facing code paths. **tests/helpers/** is harness—do not mirror helper implementation; coverage is driven by **behavior asserted in cli test files**. MUST NOT mirror test file layout. MUST NOT encode global repo/process rules (those stay in root instruction docs). On orthogonality conflicts with root instructions, adjust spec wording—not root—unless the user is explicitly changing process. For this initial authoring pass: every theme/topic covered by tests/cli must have a corresponding spec representation (strict start state). **Canonical pin / pin_set decision-tree prose** from `docs/PIN_*` is **git-46zo** (single home in one area spec)—here, only include CLI pin behavior **to the extent tests/cli already exercises it**; avoid duplicating full contract text that 46zo will merge elsewhere. Non-goals entries are allowed when they clarify what the system does (not meta about what to omit from the spec). Git history only—no spec changelog sections. Where AGENTS.md treats CLI `--help` as normative, keep spec consistent with user-visible CLI strings or flag intentional gaps for follow-up.

## Acceptance Criteria

specs/cli.md exists; **links to** HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md and does not contradict it; strict topic coverage vs **tests/cli** test files; length discipline; no global process rules; aligns with mandate orthogonality/precedence; pin contract depth defers to **git-46zo** except where tests/cli already require stated behavior.

