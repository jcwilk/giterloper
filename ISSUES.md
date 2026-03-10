# Open Issues

Current open issues identified during development.

## 1. QMD cache/config files left behind after E2E tests

**Observed:** Orphaned files in `.giterloper/qmd/cache/qmd/` and `.giterloper/qmd/config/qmd/` after test runs (e.g. `merge-tgt_gle2e_...sqlite` for pins that should have been removed).

**Path structure:** XDG conventions use `$XDG_CONFIG_HOME/<app>/` and `$XDG_CACHE_HOME/<app>/`. gl sets `XDG_CONFIG_HOME=.giterloper/qmd/config` and `XDG_CACHE_HOME=.giterloper/qmd/cache`. The qmd tool creates its own `qmd` subdir, so full paths are `.giterloper/qmd/config/qmd/` and `.giterloper/qmd/cache/qmd/`.

**Cause:** `cleanupQmdFiles` runs only when `pin remove` or `teardownPinData` completes. When a test fails before teardown (or when pin state is inconsistent so remove doesn't fully run), qmd index DBs and configs are never deleted. The `cleanupLeakedTestPins` runner in `scripts/run-e2e.ts` removes pins from `pinned.yaml` by name but does not scrub orphaned qmd files directly.

**Fix direction:** Add post-test cleanup that scans `.giterloper/qmd/config/qmd/` and `.giterloper/qmd/cache/qmd/` for files whose basename contains the E2E marker (`gle2e_`) and deletes them, regardless of pin state.

---

## 2. Promote/test: `git checkout` "unable to read tree"

**Observed:** The promote flow sometimes fails with:
```
fatal: unable to read tree (2d044f69e413aa6d1a119732b4d2fb254d6a66ba)
```

**Cause:** Occurs during `clonePin` in `updatePinSha` when running `git checkout <sha>` in a fresh clone (see `lib/pin-lifecycle.ts` lines 67–97). Clones use `--depth 1`; if the target SHA is not in the shallow history (e.g. SHA is on a different branch or behind the shallow tip), git cannot read the tree object.

**Fix direction:** Investigate whether `--depth 1` can be relaxed for promote flows, or use `git fetch --depth N` to fetch the specific SHA before checkout. Alternatively, use `--branch <branch>` when the SHA is known to be on that branch so the shallow clone includes it.
