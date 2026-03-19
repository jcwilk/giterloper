---
id: skr-scn7
status: closed
deps: []
links: []
created: 2026-03-19T20:46:12Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Parallel tests, topic-based layout, MCP naming, doc-first truth

Reorganize testing and documentation so agent development stays fast and safe: (1) all tests runnable in parallel with per-session isolation where needed; (2) replace e2e-centric layout with topic-oriented suites (mcp, cli, core) and rename integration coverage to MCP-focused naming; (3) move CLI tool coverage from heavy integration runs into unit-style tests with injectable session IDs; (4) establish and document a strict source-of-truth hierarchy after bringing docs/help/MCP strings up to date. MCP integration tests keep live GitHub for now; mocking/de-flaking remote calls is explicitly deferred until structure stabilizes. Canonical pin/MCP behavior remains governed by docs/PIN_SETTING_PARAM_BEHAVIOR.md and related specs where cited.


## Notes

**2026-03-19T22:47:25Z**

Epic closure: in-scope children (vakd, s5lu, jx74, nx83, gbqe, 7uqk) delivered topic layout, doc-first AGENTS hierarchy, parallel core + serial cli/mcp runner (shared Deno.env/.giterloper), unique CLI session IDs. skr-wsef remains open as deferred backlog (remote mocking). lib/run.ts default spawn cwd avoids deleted-cwd flakes. check_all passed.
