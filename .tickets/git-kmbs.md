---
id: git-kmbs
status: open
deps: [git-cfli]
links: []
created: 2026-03-18T23:01:06Z
type: task
priority: 1
assignee: user.email
parent: git-tsxe
---
# Add --session-id flag to gl and gl-maintenance CLI entrypoints

In lib/gl.ts main() (line 440) and lib/gl-maintenance.ts main() (line 217): after parsing --json, parse optional --session-id <id> using parseFlag(args, '--session-id'). If not provided, default to the string literal '_cli'. Pass the resolved session id to makeState(sessionId). '_cli' is just a reserved session id string used in these two places only — it is not a constant, not exported, and does not appear in any MCP code. In lib/cli.ts: add --session-id <id> to TOP_HELP (lines 76-91) and MAINTENANCE_HELP (lines 93-111) under a Global Options section.

## Design

parseFlag(args, '--session-id') before command dispatch. Default '_cli'. No env var, no constant. The string literal appears in gl.ts and gl-maintenance.ts only. MCP code must not reference '_cli'.

## Acceptance Criteria

gl pin list runs and operates under .giterloper/sessions/_cli/. gl --session-id foo pin list operates under .giterloper/sessions/foo/. gl-maintenance --session-id bar status operates under .giterloper/sessions/bar/. gl --help shows --session-id option. gl-maintenance --help shows --session-id option. No MCP file references '_cli'.

