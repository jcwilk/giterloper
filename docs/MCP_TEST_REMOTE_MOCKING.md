# MCP integration tests: optional remote mocking (backlog)

This note captures **design options and suggested acceptance** for a future change set. It does not change runtime behavior today.

## Problem

`tests/mcp/` (and related CLI integration tests) exercise **real Git remotes** such as `github.com/jcwilk/giterloper_test_knowledge`. That implies network I/O, authentication, GitHub rate limits, and occasional flake from `could not reach remote`. After the unified **bounded parallel** harness and **per-case isolation** (temp `cwd`, `.giterloper/<sessionId>/`, injected MCP config) are stable, we may want a **faster, less externally dependent** path for day-to-day MCP test iteration—without abandoning high-signal live-remote workflows.

## Non-goals

- Replacing every integration test with mocks. Executable workflow tests against a shared test repo remain valuable; see [tests/README.md](../tests/README.md).
- Relaxing MCP or CLI contracts documented in authoritative specs (for example [specs/MCP.md](../specs/MCP.md)); any mock layer must preserve observable behavior for the scenarios it claims to cover.

## Candidate approaches

### 1. Local bare repositories (good first prototype)

Use `git init --bare` under a temp or cached directory, seed commits and branches, and point session setup (pin `repo` URLs, injected bootstrap config, or helpers) at `file://` or another **locally controlled** remote.

- **Pros:** Real git object graph, fetch/push/SHA semantics match production git paths.
- **Cons:** Anything that depends on **GitHub HTTP APIs** (for example merge flows via `gh`) still needs real credentials, stubs, or narrowed test scope.

### 2. Fixture bundles (tar or bare repo snapshots)

Check in or generate minimal bare bundles; unpack at test start.

- **Pros:** Deterministic SHAs; fully offline for covered cases.
- **Cons:** Fixture churn when contracts need new repo shapes; binary or large trees in git unless generated in CI.

### 3. Record and replay

Record successful git/HTTP interactions and replay fixed responses.

- **Pros:** Can shrink scope to a few hot paths.
- **Cons:** Brittle across git/Deno upgrades; wire protocol and SSL are awkward to mock comprehensively.

### 4. Tiered CI / selective remotes

Default PR job uses mocks for most MCP modules; a **scheduled or manual** job keeps full live-remote coverage.

- **Pros:** Clear speed win for most commits; retains periodic confidence.
- **Cons:** Two configurations to maintain; failures may surface late unless the split is documented and enforced.

## Constraints from the target test layout

- [tests/README.md](../tests/README.md): Logical cases run under a **bounded parallel** harness; mock setup must respect **per-case** `cwd`, **`.giterloper/<sessionId>/`**, and **no cross-test reliance on mutable `Deno.env`** for MCP/server configuration (inject config instead).
- Collision rules (**`RUN_ID`**, per-case `sessionId`, branch/pin naming) still apply when multiple tests share a mock remote.
- Cleanup helpers (`cleanupTestKnowledgeRepo`, etc.) must remain **test-scoped**; mock remotes may need adapter behavior where GitHub-specific steps differ.

## Suggested acceptance criteria for a future PR

Use these as a checklist when implementing optional mocking; adjust if product or test layout changes.

1. **Scope:** Document which test files or scenarios run against the mock vs live remote, and why (speed vs contract confidence).
2. **Offline / token:** Mock-covered paths run without relying on `GITERLOPER_GH_TOKEN` for GitHub (or document a single local-only auth story if unavoidable).
3. **Contracts:** No intentional drift from [specs/MCP.md](../specs/MCP.md) or other normative docs; HTTP and stdio transports stay in sync if server behavior is touched.
4. **Suite:** `deno run -A scripts/run-tests.ts` (or an explicitly documented split, e.g. nightly full-remote) passes in CI.
5. **Isolation:** Session and pin isolation rules in [tests/README.md](../tests/README.md) still hold; no new cross-test flakiness.
6. **Impact:** Brief note on reduced external calls or wall time for the default path (qualitative is fine).

## Related

- Integration test strategy: [tests/README.md](../tests/README.md) (runner, parallelism, layout, auth).
