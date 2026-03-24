---
id: git-xaio
status: closed
deps: []
links: []
created: 2026-03-24T05:35:41Z
type: task
priority: 0
assignee: user.email
parent: git-wiud
---
# Spec: optional MCP test session parent (tests/roots) — pairing docs

**Canonical env name (batch-wide):** `GITERLOPER_MCP_TEST_SESSION_PARENT` — optional, non-empty absolute or repo-relative path; **only affects layout when MCP test mode is active** (`mcpTestMode` true / `--mcp-test-mode`); when unset, behavior matches **today** (session base under effective product `projectRoot()`). Sessions live at `<resolved-parent>/.giterloper_test/<sessionId>/`; the `.giterloper_test` segment stays **literal** (parent-only override; does not violate “basename not configurable” intent in specs/MCP.md).

Normative updates: **specs/core.md** — split **repository / product root** (`GITERLOPER_PROJECT_ROOT` / `projectRoot()`) from **MCP test session filesystem parent**; **specs/MCP.md** — session path shape + env row + precedence; **specs/cli.md** — `--mcp-test-mode` layout (paired with **user-visible CLI help** in **`lib/cli.ts`** per AGENTS pairing rules — **same commit / ticket** as spec text). **tests/README.md** — rewrite bullets that today imply `GITERLOPER_PROJECT_ROOT` relocates `.giterloper_test` (it must not after this change). Document: long-lived Cursor MCP unchanged unless operators set env; **canonical harness** vs **bypass**; bounded GC namespace under `tests/roots/` (manifest detail owned by `git-jp1p`). **AGENTS.md** only if operational pairing requires it.

**Path resolution:** If the env value is **relative**, resolve to absolute using the **repository root** (same basis as `GITERLOPER_PROJECT_ROOT` when set, else `cwd` project detection — spell normatively). The **unified harness** (`git-y614`) MUST set **only an absolute** path on worker children to avoid divergent resolution when child `cwd` is a temp dir. Operators bypassing the harness may export relative values only if spec-defined anchor is clear.

**Rollout:** land spec + README in this ticket before or in lockstep with `git-toud` to avoid spec/code divergence (mandate alignment).

## Acceptance Criteria

- Specs + `tests/README.md` use the **fixed** env name `GITERLOPER_MCP_TEST_SESSION_PARENT` and document **precedence:** normal mode → env ignored; MCP test mode + unset → parent = effective product `projectRoot()`; MCP test mode + set → parent = resolved path.
- **Security / bounds:** reject unsafe paths (`..`, separators in wrong places per implementation); **validation implemented in `lib/session-layout.ts` (`git-toud`)** with spec documenting rules; harness-managed runs use only `tests/roots/...` (forward-ref `git-jp1p`).
- **CLI pairing:** `specs/cli.md` and **`lib/cli.ts`** help text for `--mcp-test-mode` updated together (optional session parent + default layout).
- **Literal** `.giterloper_test` / `.giterloper` unchanged; `GITERLOPER_PROJECT_ROOT` remains repository root for constitution, retry logs, and `state.projectRoot`.
- No contradiction between core, MCP, CLI pairing, and tests/README.

## Notes

**2026-03-24T05:44:09Z**

Docs only: GITERLOPER_MCP_TEST_SESSION_PARENT in specs/core.md, MCP.md, cli.md pairing + lib/cli.ts help; tests/README.md distinguishes product root vs session parent; forward-ref git-y614/git-jp1p/git-5skn. Implementation in git-toud.
