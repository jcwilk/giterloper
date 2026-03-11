---
name: gl
description: Interact with giterloper knowledge stores connected to this project. Use when the user needs to manage pins in .giterloper/pinned.yaml.
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
- **Branched pin**: Supports write operations (`add`, `merge`).
- **Branchless pin**: Read-only; no write ops.
- **Base store**: The pin being modified for write operations.
- **Write operations**: Add, merge.

## CLI First

Run the CLI (from workspace root):

```bash
./.cursor/skills/gl/scripts/gl --help
```

Every command supports `--help`. Use command help instead of guessing flags or behavior.

## Common Workflows

### Adding knowledge

1. Queue new content (stdin): `echo "<markdown>" | ./.cursor/skills/gl/scripts/gl add --pin <name> [--name <file>]`.
2. Repeat `add` as needed to build a paper trail of queued changes.
3. Promote: `./scripts/gl-maintenance promote --pin <name>` to commit, push, and advance the pin.

### Merging knowledge branches

1. Ensure both pins are branched.
2. Merge source pin branch into target pin branch: `./.cursor/skills/gl/scripts/gl merge <source-pin> <target-pin>`.

### Pin management

- List: `./.cursor/skills/gl/scripts/gl pin list`
- Add: `./.cursor/skills/gl/scripts/gl pin add <name> <source> [--ref <ref|sha>] [--branch <branch>]`
- Load (ensure clone exists): `./.cursor/skills/gl/scripts/gl pin load [--pin <name>]`
- Remove: `./.cursor/skills/gl/scripts/gl pin remove <name>`
- Update SHA: `./.cursor/skills/gl/scripts/gl pin update <name> [--ref <ref>]`

`pin add` automatically clones; no separate load step needed. Use `pin load` to clone pins that are in `pinned.yaml` but not yet cloned.

**Pin add semantics (SHA takes priority):**
- **Branch only** (`--branch X`): Resolve SHA from that branch, pin to both branch and SHA, clone from SHA.
- **SHA only** (`--ref <full-sha>`): Pin to SHA only (no branch), clone from SHA.
- **Branch + SHA** (`--ref <sha> --branch X`): Pin both; use the SHA you passed (do not derive from branch), clone from SHA.

### Creating a new branch (no manual git)

When adding a pin with `--branch`, if the branch does not yet exist on the remote, gl creates it automatically. No manual `git clone` or `git push` is needed.

**Branch off from main (or any ref):**
```bash
./.cursor/skills/gl/scripts/gl pin add my_feature github.com/owner/knowledge --ref main --branch my_feature
```
Then run `add`, etc. The first push during a write operation creates the remote branch.

**Branch from an earlier state:** Use `--ref` to specify the starting point (branch name, tag, or SHA):
```bash
./.cursor/skills/gl/scripts/gl pin add snapshot github.com/owner/knowledge --ref v1.0.0 --branch snapshot-v1
./.cursor/skills/gl/scripts/gl pin add experiment github.com/owner/knowledge --ref abc1234 --branch experiment
```

**Save a snapshot of current:** Pin the existing branch and work there, or create a new branch from the same ref:
```bash
./.cursor/skills/gl/scripts/gl pin add backup github.com/owner/knowledge --ref main --branch backup-2024-03
```

If `--ref` is omitted when using `--branch`, it defaults to the branch name (which will fail if the branch doesn't exist). To create a new branch, always pass `--ref <existing-ref>` (e.g. `main`) and `--branch <new-branch>`.

**Write operations** (add, promote) check branch state before proceeding:
- **Branch exists and pin SHA ≠ remote HEAD:** Fail immediately (before creating staged copy) with remote SHA. Pin the remote head under a different named pin to investigate.
- **Branch does not exist:** Proceed; the branch is created atomically when the first push runs (no empty branch, then commits).
- **Branch exists and matches:** Proceed normally.

## Write Directionality (Critical)

For write-style operations:
- The **base store** is always the `--pin` target (or default first pin).
- The **reference** is the second input (raw text, conversation context, or another pin).
- **Knowledge store boundaries:** Content intended for the knowledge store belongs in the store (staged clones under `.giterloper/staged/`, then promoted). When any knowledge operation fails—promote, clone, etc.—do not copy or write that content elsewhere in the project (e.g., `docs/`, root, ad‑hoc folders). Report the failure and let the user decide.

If directionality is ambiguous, ask the user before making changes.

## Input Types

Treat reference input as one of:
- Raw text from the conversation
- Another pin name (resolve via `./.cursor/skills/gl/scripts/gl pin list` and `--pin`)
- A full asset reference (`source@sha`) that must be resolved/cloned

If the input type is unclear, ask a clarifying question first.

## Guidance and Safety

- Run `./.cursor/skills/gl/scripts/gl diagnostic` before making assumptions about local state.
- If the script reports a state error, fix state (pin, clone) before retrying.
- Write operations fail if the tracked branch is stale; run `./.cursor/skills/gl/scripts/gl pin update <name>` and retry.
- Confirm with the user before destructive actions (pin remove).
- Never edit `.giterloper/versions/` directly; write via add/promote flow only.
