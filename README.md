# Giterloper

Giterloper manages git-based knowledge stores. It runs from this repository.

## What's here

- **Constitution** — `CONSTITUTION.md` and `CONSTITUTION.md5` define the normative operation contract. The canonical constitution lives in the knowledge store; this copy supports verification.
- **`gl` skill** — `.cursor/skills/gl/` provides the CLI for searching, querying, and managing knowledge stores.
- **Bootstrap** — `bootstrap/` documents setup and verification.

## Knowledge stores

Knowledge lives in separate repositories. The default store is [giterloper_knowledge](https://github.com/jcwilk/giterloper_knowledge). Store connections are defined in `.giterloper/pinned.yaml`:

```yaml
<name>: <source>@<sha>
```

Each pin uses an exact commit SHA. Cloned stores live under `.giterloper/versions/<name>/<sha>/`. Temporary write clones use `.giterloper/staged/<name>/<branch>/`.

## Quick start

1. Ensure prerequisites: git, [Deno](https://deno.land), and QMD (`qmd status` or `npm install -g @tobilu/qmd`).
2. From this repo: `deno run -A lib/gl.ts clone` then `deno run -A lib/gl.ts index` (or `npm run gl clone` / `npm run gl index`)
3. See `bootstrap/02-verification.md` for verification steps.

See `bootstrap/` for detailed setup.

## Tests

E2E tests use random pin/branch names per run and can execute in parallel:

```bash
deno run -A scripts/run-e2e.ts
# or: npm run test:e2e
```

Unit tests:

```bash
deno test -A tests/unit/
# or: npm run test:unit
```

See `AGENTS.md` for collision-avoidance guidance.
