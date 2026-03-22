---
id: git-ncc2
status: closed
deps: [git-4azd]
links: []
created: 2026-03-22T18:53:05Z
type: chore
priority: 2
assignee: user.email
parent: git-snjk
---
# Remove reference_client tree and repo hygiene

Delete `reference_client/` entirely (`deno.json`, `deno.lock`, `run.ts`, `README.md`, tests). Update `.dockerignore` (remove or adjust `reference_client` line).

**Import policy (this ticket):** No remaining **source** imports from `reference_client/` anywhere under the repo except policy allows (e.g. historical `.tickets/.archive/` if any). **Prose** in `specs/MCP.md`, `tests/README.md`, `AGENTS.md`, etc. may still say `reference_client` until **git-i3e8** removes those strings — do **not** gate closure of this ticket on a global `rg reference_client` clean (active `.tickets/*.md` will also mention the path).

## Design

Confirm root `deno.json` `imports` resolve `@modelcontextprotocol/sdk/client/index.js` and `.../streamableHttp.js` (or paths used by `tests/helpers/mcp-http-client.ts`) the same way as today’s `reference_client` client.

## Acceptance Criteria

- `reference_client/` directory absent; `.dockerignore` updated consistently.
- No `from "...reference_client` / no import specifier containing `reference_client/` in repo **source** (exclude `.tickets/.archive/` per project policy if needed).
- `./scripts/check_all.sh` green (includes harness + typecheck path used by check-all).

