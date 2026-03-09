# Migration to TypeScript

This document outlines the plan to incrementally restructure the giterloper codebase into TypeScript modules, extract logic from the monolithic `gl.mjs`, and establish a structure conducive to maintainability, testing, and future NPM packaging.

**Conventions**: See [CONVENTIONS.md](./CONVENTIONS.md).

---

## Current State

- **`gl.mjs`**: ~1,487 lines, ~75 functions, monolithic
- **TypeScript**: Only `types/qmd-import.ts` (chunkDocument typing)
- **Tests**: E2E only; no unit tests
- **Tooling**: `tsc --noEmit`, no build step; `gl.mjs` runs directly via Node

---

## Target Structure

```
.cursor/skills/gl/
├── scripts/
│   └── gl.mjs              # Entry point; imports from dist/, routes commands
├── lib/                    # TypeScript source
│   ├── types.ts
│   ├── errors.ts
│   ├── cli.ts
│   ├── paths.ts
│   ├── run.ts
│   ├── git.ts
│   ├── pinned.ts
│   ├── locking.ts
│   ├── qmd.ts
│   ├── config.ts
│   ├── gpu.ts
│   ├── pin-lifecycle.ts
│   ├── branch.ts
│   ├── reconcile.ts
│   └── index.ts            # Re-exports for gl.mjs
└── dist/                   # Emitted JS (gl.mjs imports from here)
    └── *.js

tests/
├── e2e/                    # Unchanged
├── helpers/                # Unchanged
└── unit/                   # NEW: unit tests for pure modules
    └── *.test.ts
```

---

## Module Dependency Order

Lower-numbered modules have fewer dependencies. Extract in this order to avoid circular imports.

| Module | Depends On | Key Exports |
|--------|------------|-------------|
| types | — | Pin, GlState, RunResult, etc. |
| errors | — | EXIT, GlError, fail |
| reconcile | — | safeName, makeQueueFilename, parseSearchJson, normalizeKnowledgeRelPath, chooseMatchedKnowledgePath |
| paths | — | findProjectRoot, ensureDir, cloneDir, stagedDir |
| run | errors | run, runSoft, isBranchNotFoundError |
| locking | errors, paths | withFifoLock |
| git | run | toRemoteUrl, resolveSha, resolveBranchSha, resolveBranchShaSoft, setCloneIdentity |
| pinned | run, paths, locking, errors | parsePinned, serializePins, readPins, mutatePins, writePinsAtomic, resolvePin, ensureGiterloperRoot |
| qmd | run, pinned | pinQmd, collectionName, indexName, collectionExists, contextExists, needsEmbeddingCount, assertCollectionHealthy, cleanupQmdFiles |
| config | paths, run | readLocalConfig, writeLocalConfig |
| gpu | config, run | detectGpuMode, ensureGpuConfig |
| branch | git, pinned | requirePinBranch, assertBranchReadyForWrite, ensureWorkingClone, assertBranchFresh, branchFreshSoft |
| pin-lifecycle | qmd, git, pinned, locking | clonePin, indexPin, teardownPinData, updatePinSha, removeStagedDir |
| cli | errors | info, commandOutput, parseFlag, consumeBooleanFlag, ensureHelpNotRequested |

**Note**: `removeStagedDir` uses `runSoft`; it belongs in `pin-lifecycle` (which already has run via qmd/git).

---

## Phases (Check Off as Completed)

### Phase 1: Foundation

- [x] **1.1** Add Coding Conventions section to AGENTS.md referencing CONVENTIONS.md
- [x] **1.2** Create `lib/types.ts` with `Pin`, `GlState`, `RunResult` (and any other shared shapes)
- [x] **1.3** Configure build: tsconfig `outDir` for lib, `include` lib/**/*.ts, add `npm run build`
- [x] **1.4** Verify: `npm run build` emits JS; `gl.mjs` can `import { Pin } from '../dist/types.js'` (or equivalent path)

### Phase 2: Pure, Stateless Modules

- [x] **2.1** Extract `lib/reconcile.ts`: safeName, makeQueueFilename, parseSearchJson, normalizeKnowledgeRelPath, chooseMatchedKnowledgePath
- [x] **2.2** Add `tests/unit/reconcile.test.ts`; use Node built-in test runner (`node --test`)
- [x] **2.3** Extract `lib/paths.ts`: findProjectRoot, ensureDir, cloneDir, stagedDir (no removeStagedDir yet)
- [x] **2.4** Add `tests/unit/paths.test.ts` for findProjectRoot, cloneDir, stagedDir (use temp dirs)
- [x] **2.5** Update `gl.mjs` to import from dist/ and remove inlined implementations
- [x] **2.6** Run E2E: `node scripts/run-e2e.mjs`

### Phase 3: Error and Run Layer

- [x] **3.1** Extract `lib/errors.ts`: EXIT, GlError, fail
- [x] **3.2** Extract `lib/run.ts`: run, runSoft, isBranchNotFoundError
- [x] **3.3** Update `gl.mjs` to import from dist/
- [x] **3.4** Run E2E

### Phase 4: Pinned and I/O

- [x] **4.1** Extract `lib/locking.ts`: withFifoLock
- [x] **4.2** Extract `lib/pinned.ts`: parsePinned, serializePins, readPins, mutatePins, writePinsAtomic, resolvePin, ensureGiterloperRoot
- [x] **4.3** Add `tests/unit/pinned.test.ts` for parsePinned, serializePins (roundtrip, edge cases)
- [x] **4.4** Update `gl.mjs` to import from dist/
- [x] **4.5** Run E2E

### Phase 5: Git and QMD

- [x] **5.1** Extract `lib/git.ts`: toRemoteUrl, resolveSha, resolveBranchSha, resolveBranchShaSoft, setCloneIdentity
- [x] **5.2** Extract `lib/qmd.ts`: pinQmd, collectionName, indexName, collectionExists, contextExists, needsEmbeddingCount, assertCollectionHealthy, cleanupQmdFiles
- [x] **5.3** Update `gl.mjs` to import from dist/
- [x] **5.4** Run E2E

### Phase 6: Config and GPU

- [ ] **6.1** Extract `lib/config.ts`: readLocalConfig, writeLocalConfig
- [ ] **6.2** Extract `lib/gpu.ts`: detectGpuMode, ensureGpuConfig, printCudaInstallInstructions
- [ ] **6.3** Update `gl.mjs` to import from dist/
- [ ] **6.4** Run E2E

### Phase 7: Higher-Level Lifecycle

- [ ] **7.1** Extract `lib/branch.ts`: requirePinBranch, assertBranchReadyForWrite, ensureWorkingClone, assertBranchFresh, branchFreshSoft
- [ ] **7.2** Extract `lib/pin-lifecycle.ts`: clonePin, indexPin, teardownPinData, updatePinSha, removeStagedDir
- [ ] **7.3** Extract `lib/cli.ts`: info, commandOutput, parseFlag, consumeBooleanFlag, ensureHelpNotRequested
- [ ] **7.4** Update `gl.mjs` to import from dist/
- [ ] **7.5** Run E2E

### Phase 8: Commands and Entry Point

- [ ] **8.1** Extract command handlers into `lib/commands/` (e.g. pin.ts, search.ts, stage.ts, reconcile.ts)
- [ ] **8.2** Reduce `gl.mjs` to a thin router: parse args, dispatch to commands, handle GlError
- [ ] **8.3** Run E2E
- [ ] **8.4** (Optional) Convert `gl.mjs` → `gl.ts` and add a small `gl.mjs` wrapper that runs `gl.ts` via tsx or compiled JS

---

## Tooling

- **Build**: `tsc` only. `npm run build` compiles `lib/**/*.ts` → `dist/`.
- **Typecheck**: `npm run typecheck` remains `tsc --noEmit`; consider aligning with build config.
- **Unit tests**: Node built-in `node --test tests/unit/**/*.test.ts` (light, no extra deps).
- **E2E**: `node scripts/run-e2e.mjs` after each phase.

---

## Testability Notes

1. **Pure functions first**: parsePinned, serializePins, safeName, parseSearchJson, etc. — unit test with no mocks.
2. **Dependency injection**: For modules calling `run`/`fail`/fs, consider passing callbacks to allow test doubles.
3. **E2E as safety net**: Every phase ends with E2E pass; unit tests add guardrails for refactors.

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| 1 | ✅ | Foundation |
| 2 | ✅ | Pure modules |
| 3 | ✅ | Errors, run |
| 4 | ✅ | Pinned, locking |
| 5 | ✅ | Git, QMD |
| 6 | ⬜ | Config, GPU |
| 7 | ⬜ | Branch, lifecycle, CLI |
| 8 | ⬜ | Commands, entry point |

*(Agents: update the Status column as you complete phases.)*
