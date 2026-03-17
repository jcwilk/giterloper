# pin_set Parameter Behavior

This document defines the **exact** behavior of `giterloper_pin_set` (and equivalent pin configuration). The decision tree below MUST be implemented precisely.

## Pin Storage

Pins store exactly: **name**, **sha**, and optionally **branch**. The session pin's name is always `_session`. We never store a non-SHA ref in a pin; if the caller passes a ref (e.g. a branch or tag name), we resolve it to a SHA from the remote and store that SHA.

## Pin Name (`pin` / `pinName`)

| Input | Meaning |
|-------|---------|
| **Omitted** | Operate on the **session pin**. The session pin is the one agents use by default; it is identified by omitting the pin parameter, never by name. Its name is always `_session`. |
| **Explicit name** | Add a pin by that name (if it doesn't exist), or change an existing pin by that name. |
| **`_session`** | **Always fail.** The literal string `_session` is reserved. To refer to the session pin, omit the parameter. |

**All commands** follow this same pin-name paradigm: the reserved name is never allowed; omitting the pin parameter refers to the session pin. The only exception so far is the merge tool (see below).

---

## Merge Tool Exception

The merge tool takes **two** pin parameters (source and target). At most **one** may be omitted; whichever is omitted resolves to the session pin. **If both are omitted**, both resolve to the session pin — i.e. merging a pin into itself — which must **fail** with a message that you cannot merge a pin into itself. The same failure applies when both pin names are explicitly the same (e.g. both `"foo"`).

---

## branch and ref Matrix

When configuring a pin (session or named), the `branch` and `ref` parameters interact as follows. **ref** may be a full SHA or a ref (branch, tag, etc.); if it is not a SHA, we resolve it from the remote and use the resulting SHA. Pins always store a SHA, never a ref.

### 1. Branch specified, ref not specified

**Implication:** The agent wants to copy the **session pin's SHA** to the target pin (or update the session pin's branch).

1. **Target SHA** = session pin's current SHA.
2. **Check if the branch exists on remote.**
   - **If it does NOT exist:**
     - Take the target SHA.
     - Push the new branch to remote from a clone at that SHA.
     - Set the pin with that SHA and branch.
   - **If it DOES exist:**
     - Check if the remote branch HEAD matches the target SHA.
     - **If it matches:** Set up the pin without pushing (branch already exists).
     - **If it does NOT match:** **FAIL** with an explanation that you cannot push a different SHA to an existing branch (include pin SHA and remote branch HEAD in the error).

### 2. ref specified, branch not specified

**Implication:** Set up the target pin to point at the commit identified by **ref**, **branchlessly**. The pin is read-only: without a branch, no new commits can be added.

1. Resolve ref to a SHA from the remote (if ref is not already a full SHA).
2. Verify the SHA exists on the remote (see **SHA validation** below).
3. Set the pin with that SHA and no branch.

### 3. Both ref and branch specified

**Implication:** Set up the target pin at the commit identified by **ref** with the specified branch.

1. Resolve ref to a SHA from the remote (if ref is not already a full SHA).
2. Verify the SHA exists on the remote (see **SHA validation** below).
3. **Check if the branch exists on remote.**
   - **If it does NOT exist:**
     - Take the resolved SHA.
     - Push the new branch to remote from a clone at that SHA.
     - Set the pin with that SHA and branch.
   - **If it DOES exist:**
     - Check if the remote branch HEAD matches the resolved SHA.
     - **If it matches:** Set up the pin without pushing (branch already exists).
     - **If it does NOT match:** **FAIL** with an explanation that you cannot push a different SHA to an existing branch (include pin SHA and remote branch HEAD in the error).

### 4. Neither branch nor ref specified

**FAIL.** The caller has not specified anything meaningful to configure. This almost certainly indicates a lack of understanding of how to use the tool. Return an error directing them to specify at least one of `branch` or `ref`.

---

## SHA Validation

**At any point** where a SHA is used (resolved from ref or taken from the session pin):

- The SHA **must** exist on the remote.
- If the SHA does **not** exist on the remote, **FAIL** with a clear explanation that the SHA could not be found on the remote.

This typically happens during clone/fetch. The error message should indicate that the commit may not exist on the remote.

---

## Summary Table

| branch | ref | Behavior |
|--------|-----|----------|
| specified | not specified | Use session pin SHA. Branch exists? Match → set pin. No match → fail. Branch absent? Push branch, set pin. |
| not specified | specified | Resolve ref to SHA. Verify on remote. Set pin at SHA, branchless (read-only). |
| specified | specified | Resolve ref to SHA. Verify on remote. Branch exists? Match → set pin. No match → fail. Branch absent? Push branch, set pin. |
| not specified | not specified | **FAIL** — must specify at least one of branch or ref. |
