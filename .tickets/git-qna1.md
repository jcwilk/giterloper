---
id: git-qna1
status: open
deps: [git-9btr, git-46zo]
links: []
created: 2026-03-22T00:21:44Z
type: chore
priority: 3
assignee: user.email
parent: git-zbfq
---
# Audit docs/DEPLOYMENT_REQUIREMENTS.md and docs/FLY_IO_DEPLOYMENT.md for staleness

**Hierarchy anchor:** Operational tone only; **lowest** layer vs specs/code—on conflict, **update these docs** (see HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md after **git-9btr**). They must not assert product contracts that belong in `specs/*`.

Review both files against **concrete** repo artifacts (e.g. Dockerfile, fly.toml, `./scripts/run-docker.sh`, env vars referenced in server/CLI code—enumerate what was compared in the close note). Update prose for accuracy. If **git-46zo** removed linked paths, ensure internal links still resolve.

## Acceptance Criteria

Both files reviewed against **named** deploy artifacts; inaccuracies fixed or closure documents **bullet list of checks** (commands run, files compared, env vars spot-checked)—not a vague “ticket note” only. Links valid relative to post-**git-46zo** layout (**git-qna1** depends on **git-46zo**). Wording consistent with **docs/** as lowest layer per mandate after **git-9btr**; full **AGENTS.md** path alignment is **git-36ls** (demotion language must not contradict mandate).

