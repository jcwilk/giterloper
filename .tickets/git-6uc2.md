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

Add specs/cli.md: concise (target ≤~2 pages), deduplicated natural language, unambiguous superset of product knowledge implied by tests/cli/* and CLI-facing code paths. MUST NOT mirror test file layout. MUST NOT encode global repo/process rules (those stay in root instruction docs). On orthogonality conflicts with root instructions, adjust spec wording—not root—unless the user is explicitly changing process. For this initial authoring pass: every theme/topic covered by tests/cli must have a corresponding spec representation (strict start state). Non-goals entries are allowed when they clarify what the system does (not meta about what to omit from the spec). Git history only—no spec changelog sections.

## Acceptance Criteria

specs/cli.md exists; strict topic coverage vs tests/cli; length discipline; no global process rules; aligns with mandate orthogonality/precedence.

