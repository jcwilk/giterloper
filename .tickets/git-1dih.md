---
id: git-1dih
status: closed
deps: [git-zug8]
links: []
created: 2026-03-24T16:00:09Z
type: task
priority: 1
assignee: user.email
parent: git-vsoz
---
# Add specs/README.md hub (slice → path → tests)

Single thin index under `specs/`: table mapping slice label (MCP, CLI, core, pin-semantics) to canonical markdown path, primary test folder, and one-line pairing obligation. **In scope:** repo **root `README.md`** (onboarding links), `docs/use-cases.md`, and docs layering headers—replace redundant per-slice link sprawl with pointers to this hub and/or AGENTS **Where to read contracts**, following **git-zug8** tier rules (not only deleting a four-spec list).

## Acceptance Criteria

specs/README.md exists and lists current slices with correct relative links. Root README.md and docs/use-cases.md align with git-zug8 policy: no unnecessary concrete `specs/*.md` repeats where hub + AGENTS suffice. Links resolve on GitHub. Downstream tickets can cite **specs hub** in prose.

