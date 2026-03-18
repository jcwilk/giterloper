# Giterloper

Giterloper manages git-based knowledge stores. It runs from this repository.

## What's here

- **Constitution** — `CONSTITUTION.md` defines the contract between Giterloper and knowledge stores. Use `gl install-remote <pin>` to copy it to a pin as `GITERLOPER.md`.
- **`gl` skill** — `.cursor/skills/gl/` provides the CLI for managing knowledge stores.
- **MCP server** — Giterloper can run as an HTTP/SSE MCP server for version-pinned retrieval and knowledge intake. Indexing (when implemented) is isolated per pin+sha via memsearch; no cross-version index reuse. See `docs/MCP_API_CONTRACT.md` and `AGENTS.md`.

## Knowledge stores

Knowledge lives in separate repositories. The default store is [giterloper_knowledge](https://github.com/jcwilk/giterloper_knowledge). Store connections are defined in `.giterloper/pinned.yaml`:

```yaml
<name>: <source>@<sha>
```

Each pin uses an exact commit SHA. Cloned stores live under `.giterloper/versions/<name>/<sha>/`. Temporary write clones use `.giterloper/staged/<name>/<branch>/`.

## Quick start

1. Prerequisites: git and [Deno](https://deno.land).
2. Add a pin: `./.cursor/skills/gl/scripts/gl pin add <name> <source> [--ref <ref>] [--branch <branch>]` (clones automatically).
   - Or load existing pins: `./.cursor/skills/gl/scripts/gl pin load` (or `--pin <name>` for one).
3. Verify: `./.cursor/skills/gl/scripts/gl diagnostic`.

See `AGENTS.md` for contributor and agent guidance.

**Run environment:** Development and tests use **native Deno** (and git) on the host for fast feedback. **Docker** is for production (Fly.io) and optional local run when you want to match the container environment.

## Docker (production and optional local run)

Production deploys use the Docker image on Fly.io. To run the MCP server in Docker locally (e.g. to match production): `./scripts/run-docker.sh --build`. See `docs/FLY_IO_DEPLOYMENT.md` for Fly.io deploy and local Docker details.

## Tests

E2E tests use random pin/branch names per run:

```bash
deno run -A scripts/run-e2e.ts
```

Unit tests:

```bash
deno test -A tests/unit/
```

See `tests/README.md` for collision-avoidance and test strategy guidance.
