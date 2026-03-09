# Open Issues

Issues identified during recent work on the fail/lock fix and test suite. Not exhaustive; these are the ones surfaced in this session.

## 1. Orphaned version when `updatePinSha` fails mid-flow (resolved)

**Observed:** The failed "promote pushes and updates pin" test left behind
`.giterloper/versions/scratch-promote_gle2e_.../2d044f69e413aa6d1a119732b4d2fb254d6a66ba/` even though the test's `finally` block runs `ensurePinRemoved(pinName)`.

**Cause:** `updatePinSha` does, in order:
1. `clonePin(newPin)` — creates a clone at `versions/<pin>/<newSha>/`
2. `indexPin(newPin)`
3. `teardownPinData(oldPin)` — removes `versions/<pin>/<oldSha>/`
4. `mutatePins(...)` — updates pinned.yaml to point at newSha

If step 1 or 2 fails (e.g. `git checkout` in clonePin fails with "unable to read tree"), we never reach steps 3–4. The pin in pinned.yaml still points at oldSha. When `gl pin remove` runs in the test's finally, it tears down the *old* clone only. The new clone at `versions/<pin>/<newSha>/` is never associated with the pin and is orphaned.

**Fix (applied):** Wrapped `updatePinSha` in try/catch. On failure, `teardownPinData(state, newPin, { strict: false })` is called to remove the newly created clone and index before rethrowing. The `{ strict: false }` avoids failing when the new pin was only partially indexed (e.g. clonePin succeeded but indexPin failed, in which case qmd context/collection may not exist yet).

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

## 6. `gl merge` fails with shallow fetch (depth=1); better merge workflow needed (WIP)

**Observed:** `gl merge` uses `git fetch --depth 1` when fetching the source branch into the target's staged clone. With shallow history, git often cannot find the merge base, leading to merge failures or conflicts. Increasing to an arbitrary depth (e.g. `--depth 100`) "fixes" it by hoping the branches diverged recently, but that is brittle and wastes bandwidth.

**Preferred fix (not yet implemented):**

1. **Attempt trivial merge remotely first** — Use the remote (e.g. via `gh` or git server capabilities) to merge the branches when they merge trivially, without downloading full history or an arbitrary recent subset. If the remote can fast-forward or perform a trivial merge, do it there and update pins accordingly.

2. **If not trivially mergeable** — Ensure both branches are pinned (merge already requires this). Stage a change for the target branch:
   - With partial merge applied, if possible without downloading full history; or
   - If not possible, stage the pre-merged state of the target branch so the agent can conduct the merge manually in the staged clone.

3. **Add `gl complete-merge` (or `gl finish-merge`)** — A follow-up command the agent invokes once the merged code is prepared (e.g. after resolving conflicts or conducting the merge manually). It creates the merge commit and pushes.

**Status:** The merge command is WIP. The merge test is marked pending until this is addressed.

---

## 7. Silent catch blocks swallow errors and hinder debugging

**Observed:** Several `catch {}` blocks in gl.mjs discard errors entirely, with no logging or propagation. When something fails in these paths, users and maintainers get no signal.

**Locations and impact:**

| Location | What’s caught | Effect |
|----------|---------------|--------|
| `withFifoLock` (stale ticket cleanup) | `unlinkSync(path.join(lockDir, e))` | Stale lock tickets that can’t be removed stay on disk. The lock logic continues; in rare edge cases this could leave inconsistent lock state. |
| `withFifoLock` (finally, lock release) | `unlinkSync(ticketPath)` | If our own ticket can’t be removed on unlock, we silently continue. Subsequent waiters may see unexpected ordering; the lock directory can accumulate stale tickets. |
| `cleanupQmdFiles` | `unlinkSync(path.join(dir, f))` | QMD index/config files that fail to delete (permissions, locks, etc.) are left behind. Orphaned `.sqlite` and config files accumulate in `.giterloper/qmd/{config,cache}/qmd/`. |
| `readLocalConfig` | `readFileSync` + `JSON.parse` | Malformed or corrupted `local.json` (e.g. invalid JSON, wrong encoding) produces an empty `{}` and is never reported. Misconfigured GPU mode or other local settings fail silently. |
| `parseSearchJson` | `JSON.parse(text)` | Invalid or truncated QMD search output (e.g. QMD version mismatch or crash) becomes `[]`. Reconcile proceeds with empty search results and may misplace added content or skip subtracts that should have matched. |

**General concern:** Silent failure violates the expectation that the CLI reports problems. When the cause is non-obvious, users and agents waste time. Logging at least to stderr would preserve observability without changing behavior.

**Fix direction:**
- Log caught errors (e.g. `info()` or `console.warn`) before continuing, especially in `cleanupQmdFiles` and `readLocalConfig`.
- For `parseSearchJson`, consider warning when reconcile expects meaningful search results but gets `[]`, or failing when the output looks truncated.
- For lock-related catches, logging may suffice; removing stale tickets is best-effort but should be visible if it fails.

---

## 8. Unguarded synchronous I/O surfaces as generic "unexpected error"

**Observed:** Many `readFileSync`, `writeFileSync`, and similar calls are not wrapped in try/catch. When these throw (ENOENT, EACCES, EISDIR, etc.), the exception reaches the top-level handler and is reported as:

```
gl: unexpected error: <message>
```

with exit code EXTERNAL (3). The original failure (e.g. missing file, permission denied) is lost in a generic message.

**Examples of unwrapped synchronous I/O:**

- `readPins` → `readFileSync(state.pinnedPath)` — ENOENT is handled earlier by `ensureGiterloperRoot`, but EACCES or corrupt read would surface generically.
- `ensureGitignoreEntries` → `readFileSync(ignorePath)` when the file exists — permission or read errors bubble up.
- `readStdinOrFail` → `readFileSync(0, "utf8")` — EOF or read errors on stdin.
- `cmdReconcile` → multiple `readFileSync` in the queue-processing loop — any unreadable file (permissions, symlink loop) causes a generic failure.
- `parsePinned` → called with content from `readFileSync`; the read itself is in the caller.
- `mutatePins` mutator → `readFileSync` / `writeFileSync` / `renameSync` — lock held; a write failure could leave a `.tmp` file.

**General concern:** The CLI’s exit code scheme (USER / STATE / EXTERNAL) is designed to help scripts and automation. Collapsing all I/O and filesystem errors into EXTERNAL hides whether the problem is configuration (STATE), user input (USER), or environment (EXTERNAL). Clearer handling would allow scripts to react more intelligently.

**Fix direction:**
- Wrap critical reads in try/catch and rethrow or `fail()` with context (e.g. “cannot read pinned.yaml: Permission denied”).
- Map common errors to appropriate exit codes (e.g. missing `.giterloper/` → STATE; stdin read failure → USER).
- Consider helper wrappers (e.g. `readFileOrFail(path, purpose)`) to centralize error handling.

---

## 9. Branch-not-found detection relies on fragile string matching

**Observed:** `isBranchNotFoundError(r)` decides whether a git clone/checkout failed because the branch doesn’t exist by matching substrings in stderr/stdout:

```javascript
(msg.includes("remote branch") && msg.includes("not found")) ||
msg.includes("could not find remote branch") ||
(msg.includes("pathspec") && msg.includes("did not match"))
```

**Context:** This heuristic controls two distinct behaviors: (1) in `clonePin` (e.g. `gl pin add` with `--branch`), a “branch not found” triggers a fallback (clone default ref and create branch); (2) in `ensureWorkingClone` and `cmdStage`, it triggers branch creation from the default branch. A false positive (other git error containing those phrases) could create a branch when we should fail. A false negative (git changes wording) could fail when we should create.

**Risks:**
- Git’s wording varies by version and locale; messages may change.
- Similar phrases can appear in unrelated errors (e.g. “pathspec” in a different failure mode).
- Non-English git installations may produce different strings.

**General concern:** Behavior that depends on parsing tool output is brittle. Prefer exit codes or structured output (e.g. `git ls-remote` to check branch existence before clone) when possible.

**Fix direction:**
- Use `git ls-remote --heads <remote> <branch>` to probe existence before cloning; if the branch is absent, then invoke the create-branch path.
- If string matching is kept, broaden patterns and add tests for both “branch missing” and “other clone failure” to avoid regressions.
- Document the assumption that git produces English-style messages, or add a way to override (e.g. env var for CI/locale).
