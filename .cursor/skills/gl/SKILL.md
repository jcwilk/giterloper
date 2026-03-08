---
name: gl
description: Interact with giterloper knowledge stores connected to this project. Use when the user needs to search, query, retrieve, verify, stage, promote, or manage pins in .giterloper/pinned.yaml.
---

# gl

## Overview

Use this skill for giterloper operations in this project.

Project state lives in `.giterloper/`:
- `.giterloper/pinned.yaml`: pin name -> `source@sha`
- `.giterloper/versions/`: read-only clones at exact SHAs
- `.giterloper/staged/`: temporary working clones for write operations

Pins always use full 40-character commit SHAs. If `--pin` is omitted, the first pin in `.giterloper/pinned.yaml` is the default.

## Core Concepts

- **Pin**: A named store reference (`name`, `source`, `sha`).
- **Collection**: QMD index name derived as `<name>@<sha>`.
- **Base store**: The pin being modified for write operations.
- **Reference input**: The comparison source (raw text, conversation context, or another pin).
- **Read operations**: Search, query, retrieve, verify.
- **Write operations**: Stage, edit, promote, teardown.

## CLI First

Run the CLI script:

```bash
node .cursor/skills/gl/scripts/gl.mjs --help
```

Every command supports `--help`. Use command help instead of guessing flags or behavior.

## Common Workflows

### Answering from context

1. Run `node .cursor/skills/gl/scripts/gl.mjs query "<question>"` or `node .cursor/skills/gl/scripts/gl.mjs search "<keywords>"`.
2. If needed, run `node .cursor/skills/gl/scripts/gl.mjs get "<path>" --full`.
3. Respond with citations to file paths/headings from retrieved content.

### Retrieving context

1. Run multiple `node .cursor/skills/gl/scripts/gl.mjs search` or `node .cursor/skills/gl/scripts/gl.mjs query` commands if the request spans topics.
2. Fetch full docs with `node .cursor/skills/gl/scripts/gl.mjs get`.
3. Summarize what is relevant and where it was found.

### Verifying claims

1. Search broadly with main terms and synonyms.
2. Look for both supporting and contradicting evidence.
3. Report one of: supported, contradicted, or not addressed.

### Adding knowledge

1. Search for overlap first.
2. Create staged clone: `node .cursor/skills/gl/scripts/gl.mjs stage <branch>`.
3. Edit content in `.giterloper/staged/...`.
4. Promote: `node .cursor/skills/gl/scripts/gl.mjs promote <branch>`.

### Subtracting knowledge

1. Identify overlap between base store and reference content.
2. Stage a branch and remove overlapping content in staged clone.
3. Promote with `node .cursor/skills/gl/scripts/gl.mjs promote <branch>`.

### Intersecting knowledge

1. Identify overlapping vs non-overlapping content.
2. Stage a branch and remove non-overlapping content from staged clone.
3. Promote with `node .cursor/skills/gl/scripts/gl.mjs promote <branch>`.

### Pin management

- List: `node .cursor/skills/gl/scripts/gl.mjs pin list`
- Add: `node .cursor/skills/gl/scripts/gl.mjs pin add <name> <source> [--ref <ref>]`
- Remove: `node .cursor/skills/gl/scripts/gl.mjs pin remove <name>`
- Update SHA: `node .cursor/skills/gl/scripts/gl.mjs pin update <name> [--ref <ref>]`
- Add pin, then materialize: `gl pin add <name> <source> [--ref <ref>]` then `gl clone` and `gl index`

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
- Another pin name (resolve via `node .cursor/skills/gl/scripts/gl.mjs pin list` and `--pin`)
- A full asset reference (`source@sha`) that must be resolved/cloned/indexed

If the input type is unclear, ask a clarifying question first.

## Guidance and Safety

- Prefer `node .cursor/skills/gl/scripts/gl.mjs status` before making assumptions about local state.
- Use `node .cursor/skills/gl/scripts/gl.mjs verify` after clone/index or promotions.
- If the script reports a state error, fix state (pin, clone, index) before retrying.
- Confirm with the user before destructive actions (teardown, subtract, intersect).
- Never edit `.giterloper/versions/` directly; write via staged clones only.
