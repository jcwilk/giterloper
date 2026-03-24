---
id: git-7cxd
status: open
deps: [git-6m0f]
links: []
created: 2026-03-24T17:07:49Z
type: task
priority: 1
assignee: user.email
parent: git-rv1n
---
# Refactor AGENTS.md: hub-only content, fix MCP .env, dedupe sections

Implement cross-critique consensus on AGENTS.md structure and accuracy.

Scope (all in AGENTS.md unless noted):

1. **Task Tracking:** Keep ./tk usage, no ./tk list (ready/blocked/closed), task completion requires commit and push, closed ticket with dirty tree is not done. **Remove** the bulleted list of slash-commands and skill paths (/work-all, /realign-divergences, /file-tickets, /archive-tickets, /spec-change, /work-next). Optional one neutral line: ticket-related workflows live under .cursor/skills/ and .cursor/agents/ and are user-invoked.

2. **Remove** the standalone **Multi-model critique** section (redundant with skills metadata and Skills vs agents).

3. **Skills vs agents:** Keep folder boundary (skills inline, agents via Task; do not open agents/*.md and execute in parent thread). **Shorten** the Strong nudge paragraph: state the rule without enumerating verifier, work-next, cross-critique-* paths. **Exception:** Keep a single explicit carve-out that verifier-shaped gates require spawning the verifier subagent via Task (per current AGENTS intent)—do not drop that safety requirement.

4. **Remove** **Gl Script Notes**, **pinned.yaml Format**, and **MCP session pin (_session) and pin_set semantics** subsection entirely. Ensure **Where to read contracts** still points to specs/pin-semantics.md for pin/session law.

5. **Run environment:** Shorten the Tests bullet under memsearch/CLI to a one- or two-line pointer: deno task test / scripts/run-tests.ts + tests/README.md for harness details. Do not duplicate DENO_JOBS, discovery, JUnit gate, tests/core|cli|mcp|pin-semantics enumeration in AGENTS.

6. **Project structure:** Replace brittle subdirectory enumeration with brief stable hubs: lib/, tests/ (topic tests per tests/README.md), specs/, scripts/, .cursor/skills/, .cursor/agents/. Omit per-topic test folder list and duplicate gl script path if already covered in Running the CLI. Optionally mention docs/, .tickets/, .giterloper/ session roots in one line or defer to tests/README addition in sibling ticket.

7. **External retries:** Remove the **External retries** section from AGENTS.md. **git-6m0f** must already be closed so CONVENTIONS.md contains the replacement guidance before removal (repo never lacks a pointer). AGENTS may retain zero or one sentence pointer to CONVENTIONS.md if useful.

8. **MCP server (Cursor Cloud section):** Collapse normative duplication. Defer tool semantics, _session bootstrap, KNOWLEDGE_STORE_REMOTE requirements, index isolation, parity guardrails, endpoints/auth details to specs/mcp.md and specs/README.md. Keep operational essentials: deno task mcp:serve / mcp:serve-stdio / :test variants, --mcp-test-mode pointer, link to docs/FLY_IO_DEPLOYMENT.md, minimal auth/insecure note only if not fully redundant with spec.

9. **Fix Cursor (stdio MCP) .env paragraph:** Replace overstated claim. Accurate rule: .env loading depends on how the server is launched—deno.json tasks (and repo wrapper scripts if any) pass --env-file=.env; raw deno run without that flag does not load repo .env. Do not require duplicating env into Cursor Settings unless the user launch config omits --env-file.

10. **Reduce duplication** between **Run environment** and **Cursor Cloud** blocks where reasonable (single runbook flow + Cursor Cloud deltas for token/Deno install) without losing Cloud-specific auth guidance.

Acceptance: AGENTS.md is materially shorter; no conflicting normative pin/MCP detail vs specs; Cursor .env guidance matches deno task behavior; ./tk invariants preserved; verifier spawn rule preserved; deno check or doc-only sanity as needed.

## Acceptance Criteria

- AGENTS.md: Task Tracking has no enumerated slash-command/skill list; Multi-model critique section removed.
- Skills vs agents: shortened enumeration; verifier still explicitly requires Task spawn for verifier-shaped gates.
- Gl Script Notes, pinned.yaml format block, and MCP session pin subsection removed; pin-semantics still linked from Where to read contracts.
- Run environment Tests bullet is a short pointer to tests/README.md (no harness internals duplicated).
- Project structure is brief hubs only (no tests/core|cli|mcp|pin-semantics list; no duplicate gl path if CLI section covers it).
- External retries section removed from AGENTS (CONVENTIONS ticket owns the text).
- MCP subsection: minimal ops + spec pointers; Cursor stdio .env wording is launcher-conditional and accurate vs deno.json tasks.
- No new contradictions with specs/mcp.md or specs/pin-semantics.md (spot-check).

