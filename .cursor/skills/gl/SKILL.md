---
name: gl
description: Interact with giterloper knowledge stores connected to this project. Use when the user needs to search, query, retrieve, verify, stage, promote, or manage pins in .giterloper/pinned.yaml.
---

# gl

## Overview

Use this skill for giterloper operations in this project.

Project state lives in `.giterloper/`:
- `.giterloper/pinned.yaml`: pin name -> object with `repo`, `sha`, optional `branch`
- `.giterloper/versions/`: read-only clones at exact SHAs
- `.giterloper/staged/`: temporary working clones for write operations

Pins always use full 40-character commit SHAs. If `--pin` is omitted, the first pin in `.giterloper/pinned.yaml` is the default.

## Core Concepts

- **Pin**: A named store reference (`name`, `source`, `sha`, optional `branch`).
- **Branched pin**: Supports write operations (`add`, `subtract`, `reconcile`, `promote`, `merge`).
- **Branchless pin**: Read-only for `search`, `query`, `get`, `verify`.
- **Collection**: QMD index name derived as `<name>@<sha>`.
- **Base store**: The pin being modified for write operations.
- **Reference input**: The comparison source (raw text, conversation context, or another pin).
- **Read operations**: Search, query, retrieve, verify.
- **Write operations**: Stage, edit, promote, teardown.

## CLI First

Run the CLI script:

```bash
deno run -A lib/gl.ts --help
```

Or from package scripts: `npm run gl --help`

Every command supports `--help`. Use command help instead of guessing flags or behavior.

## Common Workflows

### Answering from context

1. Run `deno run -A lib/gl.ts query "<question>"` or `deno run -A lib/gl.ts search "<keywords>"`.
2. If needed, run `deno run -A lib/gl.ts get "<path>" --full`.
3. Respond with citations to file paths/headings from retrieved content.

### Retrieving context

1. Run multiple `deno run -A lib/gl.ts search` or `deno run -A lib/gl.ts query` commands if the request spans topics.
2. Fetch full docs with `deno run -A lib/gl.ts get`.
3. Summarize what is relevant and where it was found.

### Verifying claims

1. Search broadly with main terms and synonyms.
2. Look for both supporting and contradicting evidence.
3. Report one of: supported, contradicted, or not addressed.

### Adding knowledge

1. Queue new content (stdin): `echo "<markdown>" | deno run -A lib/gl.ts add --pin <name> [--name <file>]`.
2. Repeat `add` as needed to build a paper trail of queued changes.
3. Reconcile queue into `knowledge/`: `deno run -A lib/gl.ts reconcile --pin <name>`.
4. Optional finalization: `deno run -A lib/gl.ts promote --pin <name>`.

### Subtracting knowledge

1. Queue subtraction intent (stdin): `echo "<markdown>" | deno run -A lib/gl.ts subtract --pin <name> [--name <file>]`.
2. Reconcile queue into `knowledge/`: `deno run -A lib/gl.ts reconcile --pin <name>`.

### Merging knowledge branches

1. Ensure both pins are branched.
2. Merge source pin branch into target pin branch: `deno run -A lib/gl.ts merge <source-pin> <target-pin>`.

### Intersecting knowledge

1. Identify overlapping vs non-overlapping content.
2. Stage a branch and remove non-overlapping content from staged clone.
3. Promote with `deno run -A lib/gl.ts promote <branch>`.

### Pin management

- List: `deno run -A lib/gl.ts pin list`
- Add: `deno run -A lib/gl.ts pin add <name> <source> [--ref <ref>] [--branch <branch>]`
- Remove: `deno run -A lib/gl.ts pin remove <name>`
- Update SHA: `deno run -A lib/gl.ts pin update <name> [--ref <ref>]`
- Add pin, then materialize: `gl pin add <name> <source> [--ref <ref>] [--branch <branch>]` then `gl clone` and `gl index`

### Creating a new branch (no manual git)

When adding a pin with `--branch`, if the branch does not yet exist on the remote, gl creates it automatically. No manual `git clone` or `git push` is needed.

**Branch off from main (or any ref):**
```bash
gl pin add my_feature github.com/owner/knowledge --ref main --branch my_feature
```
Then run `gl add`, `gl reconcile`, etc. The first push during a write operation creates the remote branch.

**Branch from an earlier state:** Use `--ref` to specify the starting point (branch name, tag, or SHA):
```bash
gl pin add snapshot github.com/owner/knowledge --ref v1.0.0 --branch snapshot-v1
gl pin add experiment github.com/owner/knowledge --ref abc1234 --branch experiment
```

**Save a snapshot of current:** Pin the existing branch and work there, or create a new branch from the same ref:
```bash
gl pin add backup github.com/owner/knowledge --ref main --branch backup-2024-03
```

If `--ref` is omitted when using `--branch`, it defaults to the branch name (which will fail if the branch doesn't exist). To create a new branch, always pass `--ref <existing-ref>` (e.g. `main`) and `--branch <new-branch>`.

**Read vs write:** Read operations (search, query, get, verify) never push or create branches. Write operations (add, subtract, reconcile, promote, stage) check branch state before proceeding:
- **Branch exists and pin SHA ≠ remote HEAD:** Fail immediately (before creating staged copy) with remote SHA. Pin the remote head under a different named pin to investigate.
- **Branch does not exist:** Proceed; the branch is created atomically when the first push runs (no empty branch, then commits).
- **Branch exists and matches:** Proceed normally.

## Write Directionality (Critical)

For write-style operations:
- The **base store** is always the `--pin` target (or default first pin).
- The **reference** is the second input (raw text, conversation context, or another pin).
- **Subtract**: remove reference-overlapping content **from** the base.
- **Intersect**: keep only content in the base that overlaps **with** the reference.
- **Knowledge store boundaries:** Content intended for the knowledge store belongs in the store (staged clones under `.giterloper/staged/`, then promoted). When any knowledge operation fails—promote, index, clone, etc.—do not copy or write that content elsewhere in the project (e.g., `docs/`, root, ad‑hoc folders). Report the failure and let the user decide. Orphaned copies outside the store are unindexed, inconsistent, and unhelpful.

If directionality is ambiguous, ask the user before making changes.

## Input Types

Treat reference input as one of:
- Raw text from the conversation
- Another pin name (resolve via `deno run -A lib/gl.ts pin list` and `--pin`)
- A full asset reference (`source@sha`) that must be resolved/cloned/indexed

If the input type is unclear, ask a clarifying question first.

## Guidance and Safety

- Prefer `deno run -A lib/gl.ts status` before making assumptions about local state.
- Use `deno run -A lib/gl.ts verify` after clone/index or promotions.
- If the script reports a state error, fix state (pin, clone, index) before retrying.
- Write operations fail if the tracked branch is stale; run `gl pin update <name>` and retry.
- Confirm with the user before destructive actions (teardown, subtract, intersect).
- Never edit `.giterloper/versions/` directly; write via staged clones only.
