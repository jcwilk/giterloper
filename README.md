# Giterloper

Giterloper manages git-based knowledge stores. It runs from this repository.

## Specs, tests, and code

This README is **human** onboarding for the repo layout. **Product behavior** is defined under **`specs/`** (area specs such as CLI, MCP, and core pin semantics). **Motivation and use-case narrative** (non-normative) lives in [`specs/product-context.md`](./specs/product-context.md). **`tests/`** holds the executable harness and topic slices (`tests/core/`, `tests/cli/`, `tests/mcp/`); see [`tests/README.md`](./tests/README.md). **Implementation** lives primarily in **`lib/`** (CLI and MCP server).

For AI agent and contributor workflow and conventions, see [`AGENTS.md`](./AGENTS.md).

## What's here

- **Constitution** — `CONSTITUTION.md` defines the contract between Giterloper and knowledge stores. Use `gl install-remote <pin>` to copy it to a pin as `GITERLOPER.md`.
- **`gl` skill** — `.cursor/skills/gl/` provides the CLI for managing knowledge stores.
- **MCP server** — Giterloper can run as an HTTP/SSE MCP server for version-pinned retrieval and knowledge intake. Indexing (when implemented) is isolated per pin+sha via memsearch; no cross-version index reuse. MCP tool contracts and transport behavior: [`specs/MCP.md`](./specs/MCP.md).

## Knowledge stores

Knowledge lives in separate repositories. The default store is [giterloper_knowledge](https://github.com/jcwilk/giterloper_knowledge). Store connections are defined per session in `.giterloper/<sessionId>/pinned.yaml`:

```yaml
my_pin:
  repo: github.com/owner/repo
  sha: <40-char-commit-sha>
  branch: optional-branch-name # omit for read-only pin
```

Each pin uses an exact commit SHA. The CLI defaults to session `_cli` (override with `--session-id`). Cloned stores live under `.giterloper/<sessionId>/versions/<name>/<sha>/`. Temporary write clones use `.giterloper/<sessionId>/staged/<name>/<branch>/`.

## Quick start

1. Prerequisites: git and [Deno](https://deno.land).
2. Add a pin: `./.cursor/skills/gl/scripts/gl pin add <name> <source> [--ref <ref>] [--branch <branch>]` (clones automatically).
   - Or load existing pins: `./.cursor/skills/gl/scripts/gl pin load` (or `--pin <name>` for one).
3. Verify: `./.cursor/skills/gl/scripts/gl diagnostic`.

**Run environment:** Development and tests use **native Deno** (and git) on the host for fast feedback. **Docker** is for production (Fly.io) and optional local run when you want to match the container environment.

## Docker (production and optional local run)

Production deploys use the Docker image on Fly.io. To run the MCP server in Docker locally (e.g. to match production): `./scripts/run-docker.sh --build`. See `docs/FLY_IO_DEPLOYMENT.md` for Fly.io deploy and local Docker details.

## Tests

Run the full suite (typecheck + unified test harness):

```bash
./scripts/check_all.sh
# or: deno task check
```

Run only automated tests (same harness as CI):

```bash
deno run -A scripts/run-tests.ts
# or: deno task test
```

Topic-only slices: `deno task test:core`, `deno task test:cli`, `deno task test:mcp`.

See `tests/README.md` for the target runner (bounded parallel logical cases, flattened `.giterloper/<sessionId>/` layout, test-scoped cleanup) and collision-avoidance rules.
