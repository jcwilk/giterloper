---
id: git-61ko
status: open
deps: [git-7cxd]
links: []
created: 2026-03-24T17:07:55Z
type: task
priority: 2
assignee: user.email
parent: git-rv1n
---
# tests/README.md: brief repository layout nudges

Add a short section near the top (after intro or after spec anchoring) giving **low-churn** orientation: purpose of docs/ (operational/deployment, not product truth per mandate), .tickets/ + ./tk, session dirs .giterloper/ and .giterloper_test/, scripts/ for harness and tooling, lib/ product source. Avoid duplicating long harness text; link to existing sections where appropriate. Align with AGENTS.md trimming (AGENTS points here for test harness; this doc can own a bit more lay-of-the-land).

## Acceptance Criteria

- tests/README.md includes a concise repo layout section covering docs/, .tickets/, .giterloper/, .giterloper_test/, scripts/, lib/ (and any other stable hubs deemed useful).
- Wording avoids high-churn enumerations; references mandate/docs demotion where appropriate for docs/.

