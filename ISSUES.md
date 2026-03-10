# Open Issues

Issues identified during recent work on the fail/lock fix and test suite. Not exhaustive; these are the ones surfaced in this session.

## 1. Orphaned version when `updatePinSha` fails mid-flow

**Observed:** The failed "promote pushes and updates pin" test left behind
`.giterloper/versions/scratch-promote_gle2e_.../2d044f69e413aa6d1a119732b4d2fb254d6a66ba/` even though the test's `finally` block runs `ensurePinRemoved(pinName)`.

**Cause:** `updatePinSha` does, in order:
1. `clonePin(newPin)` — creates a clone at `versions/<pin>/<newSha>/`
2. `indexPin(newPin)`
3. `teardownPinData(oldPin)` — removes `versions/<pin>/<oldSha>/`
4. `mutatePins(...)` — updates pinned.yaml to point at newSha

If step 1 or 2 fails (e.g. `git checkout` in clonePin fails with "unable to read tree"), we never reach steps 3–4. The pin in pinned.yaml still points at oldSha. When `gl pin remove` runs in the test's finally, it tears down the *old* clone only. The new clone at `versions/<pin>/<newSha>/` is never associated with the pin and is orphaned.

**Fix direction:** On failure after `clonePin` but before `mutatePins`, explicitly remove the newly created clone at `versions/<pin>/<newSha>/` (or wrap the flow so a shared cleanup path removes it on error).

---

## 2. QMD cache/config files left behind after test runs

**Observed:** Files remain in `.giterloper/qmd/cache/qmd/` and `.giterloper/qmd/config/qmd/` after tests, e.g.:
- `merge-tgt_gle2e_...sqlite` (test pin that should have been removed)
- `knowledge_8f35bdf...sqlite` (may be from the shared test pin or main project pin)

**Why `qmd` appears twice in the path:** XDG conventions use `$XDG_CONFIG_HOME/<app>/` and `$XDG_CACHE_HOME/<app>/`. gl sets `XDG_CONFIG_HOME=.giterloper/qmd/config` and `XDG_CACHE_HOME=.giterloper/qmd/cache` to isolate qmd data under .giterloper. The qmd tool then creates its own `qmd` subdir (the app name), so the full path is `.giterloper/qmd/config/qmd/` and `.giterloper/qmd/cache/qmd/`. First `qmd` = our namespace; second `qmd` = the app's XDG subdir.

**Cause:** `cleanupQmdFiles` in teardown only runs when `pin remove` or `teardownPinData` completes. When a test fails before that (or when pin remove skips cleanup because the pin state is inconsistent), these index DBs/configs are never deleted. The `cleanupLeakedTestPins` runner only removes pins by name from pinned.yaml; it does not scrub orphaned qmd files.

**Fix direction:** Broader cleanup of qmd files whose index name matches the E2E marker (e.g. `gle2e_*`) when tests finish, or ensure teardown always runs even on partial failure.

---

## 3. Reconcile: missing `@tobilu/qmd/dist/store.js` (resolved)

**Observed:** `gl reconcile` failed with:
```
failed to load QMD chunking module: Cannot find module '@tobilu/qmd/dist/store.js'
```

**Cause:** `gl reconcile` uses `chunkDocument` from `@tobilu/qmd/dist/store.js`. That module is ESM with top-level await, so `require()` could not load it. Additionally, the package was not a local dependency, so resolution failed when run from the workspace.

**Fix (applied):** Added `package.json` with `@tobilu/qmd` as a locked dependency. Switched from `require()` to dynamic `import()` to load the ESM module. Run `npm install` before using `gl reconcile`.

---

## 4. Promote test: `git checkout` "unable to read tree"

**Observed:** The "promote pushes and updates pin" test sometimes fails with:
```
fatal: unable to read tree (2d044f69e413aa6d1a119732b4d2fb254d6a66ba)
```

**Cause:** Occurs during `clonePin` inside `updatePinSha` when running `git checkout <sha>` in a fresh clone. Possible causes: shallow clone missing objects, race with remote, or transient git/network issue. Needs investigation to see if it's flaky or environment-specific.

---

## 5. Lock ticket cleanup (resolved)

Previously, `fail()` called `process.exit()`, which bypassed `withFifoLock`'s `finally` block. Stale ticket files in `.giterloper/locks/embed/` caused subsequent embeds to busy-wait for 5 minutes. Fixed by having `fail()` throw `GlError` instead; the top-level catch translates to `process.exit()` after `finally` runs.

---

## 6. `gl merge` fails with shallow fetch (depth=1); better merge workflow needed

**Observed:** `gl merge` used `git fetch --depth 1` when fetching the source branch into the target's staged clone. With shallow history, git often cannot find the merge base, leading to merge failures or conflicts.

**Fix (applied):** Before fetching the source branch:
1. If the target's working clone is shallow (`git rev-parse --is-shallow-repository`), run `git fetch --unshallow origin` to deepen the target branch history.
2. Fetch the source branch without `--depth 1` so git has enough history to compute the merge base.

This allows trivial merges to succeed. Conflict resolution remains the same: the working clone is left in a conflicted state; the user fixes conflicts and runs `gl promote --pin <target>`.

**Future improvements (not yet implemented):**

1. **Attempt trivial merge remotely first** — Use the remote (e.g. via `gh` or git server capabilities) to merge when trivially mergeable, without downloading full history.
2. **Add `gl complete-merge`** — A follow-up command for when the agent resolves conflicts manually, then creates the merge commit and pushes.

**Status:** The shallow-fetch fix is applied. The merge test runs.
