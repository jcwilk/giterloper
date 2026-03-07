# How to use this knowledge store

This repository is a giterloper knowledge store. Knowledge content lives under `knowledge/`.

This file documents how store operations work under the hood.  
For installation into a target project, use the `bootstrap/` docs.

---

## Accessing the knowledge store

### Fixed installation layout

In target projects, giterloper state always lives under `.giterloper/`:

- `.giterloper/pinned.yaml` (committed): pin mapping `name: source@sha`
- `.giterloper/versions/` (gitignored): read-only clones at exact SHAs
- `.giterloper/staged/` (gitignored): temporary working clones for write operations

Pins must use full 40-character commit SHAs. The first pin is the default when no pin is specified.

### Clone location

Stores are materialized to:

```text
.giterloper/versions/<name>/<sha>/
```

### SHA resolution

When starting from a branch or tag:

```sh
git ls-remote https://<source> <human-ref> | cut -f1
```

Use the resolved SHA for:
- `pinned.yaml`
- clone path
- QMD collection name (`<name>@<sha>`)

### Setup commands (manual mechanics)

```sh
# Resolve SHA
SHA=$(git ls-remote https://<source> <human-ref> | cut -f1)

# Clone exact version
git clone --depth 1 https://<source> .giterloper/versions/<name>/$SHA
git -C .giterloper/versions/<name>/$SHA checkout $SHA

# Index with QMD
qmd collection add .giterloper/versions/<name>/$SHA/knowledge --name <name>@$SHA --mask "**/*.md"
qmd context add qmd://<name>@$SHA "<store description>"
qmd embed
```

### Update mechanics (manual)

```sh
NEW_SHA=$(git ls-remote https://<source> <human-ref> | cut -f1)
git clone --depth 1 https://<source> .giterloper/versions/<name>/$NEW_SHA
git -C .giterloper/versions/<name>/$NEW_SHA checkout $NEW_SHA
qmd collection add .giterloper/versions/<name>/$NEW_SHA/knowledge --name <name>@$NEW_SHA --mask "**/*.md"
qmd context add qmd://<name>@$NEW_SHA "<store description>"
qmd embed

qmd context rm qmd://<name>@$OLD_SHA
qmd collection remove <name>@$OLD_SHA
rm -rf .giterloper/versions/<name>/$OLD_SHA
```

Then update `.giterloper/pinned.yaml` to the new SHA.

### Teardown mechanics (manual)

```sh
qmd context rm qmd://<name>@<sha>
qmd collection remove <name>@<sha>
rm -rf .giterloper/versions/<name>/<sha>
```

To clean staged clones:

```sh
rm -rf .giterloper/staged/<name>/<branch-name>
```

---

## Unified CLI interface (`gl`)

Primary interface for operations is the installed `gl` script:

- `.agents/skills/gl/scripts/gl.mjs`
- or `.cursor/skills/gl/scripts/gl.mjs`

Use `--help` for discovery:

```sh
node <skills-dir>/gl/scripts/gl.mjs --help
```

The script manages:
- pin lifecycle (`pin list/add/remove/update`)
- clone/index setup (`clone`, `index`, `setup`, `teardown`)
- read operations (`search`, `query`, `get`)
- write workflow scaffolding (`stage`, `promote`, `stage-cleanup`)
- diagnostics (`status`, `verify`)

`gl` is non-interactive and returns clear state errors for agent handling.

---

## Searching with QMD

Commands used by `gl` under the hood:

- `qmd search "<keywords>"` (fast keyword search)
- `qmd query "<question>"` (hybrid + rerank; best quality)
- `qmd vsearch "<query>"` (vector search)
- `qmd get "<path>"` (retrieve full document)

Scope to a store version:

```sh
qmd search "authentication" -c <name>@<sha> --json -n 10
qmd query "how does chunking work" -c <name>@<sha> --json
qmd get "background.md" -c <name>@<sha> --full
```

Model-backed commands (`qmd query`, `qmd vsearch`, `qmd embed`) are faster with GPU acceleration.

---

## Operation mechanics

Operational intent is defined in `CONSTITUTION.md`.  
This section explains mechanical execution behavior.

### Read operations

- `answer_from_context`: search/query, optionally get full docs, answer from retrieved content only
- `retrieve_relevant_context`: run broad retrieval, summarize key excerpts with citations
- `verify_claim`: gather supporting and contradicting evidence and classify claim status

### Write operations

Write operations never edit `.giterloper/versions/` in place.

Use staged workflow:

1. Clone working copy: `.giterloper/staged/<name>/<branch>/`
2. Apply edits in staged clone
3. Commit and push staged branch
4. Resolve `NEW_SHA`, clone/index it under `.giterloper/versions/<name>/<NEW_SHA>/`
5. Tear down old indexed version
6. Update `.giterloper/pinned.yaml` so new SHA is first for that pin
7. Remove staged clone

This keeps read clones immutable and ensures each mutation becomes a reproducible SHA-pinned version.
