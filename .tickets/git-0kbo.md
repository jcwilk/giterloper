---
id: git-0kbo
status: open
deps: []
links: []
created: 2026-03-21T21:17:57Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Centralized external retries (git, GitHub fetch, logs)

Consolidate retry/backoff and rate-limit-aware waits in lib/ around network git and GitHub REST fetch; log retry events to append-only logs/ with PID/session context; remove duplicate retry layers from tests and reference_client. Source plan: .cursor/plans/centralized_external_retries_8c5f6622.plan.md (also under user .cursor/plans/). GitHub rate-limit reference: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

