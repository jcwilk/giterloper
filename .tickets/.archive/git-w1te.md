---
id: git-w1te
status: closed
deps: []
links: []
created: 2026-03-17T06:11:36Z
type: task
priority: 0
assignee: user.email
parent: git-amoh
---
# Core pinned.ts: SESSION_PIN_NAME constant, validatePinName, resolvePin, readPins/doMutatePins

Replace RESERVED_PIN_NAME='default' with SESSION_PIN_NAME='_session'. Update validatePinName to reject _session (same pattern as before, new name). Rewrite resolvePin: when pin is omitted, find by name SESSION_PIN_NAME instead of pins[0]. Make readPins return [] for missing pinned.yaml instead of throwing. Make doMutatePins handle missing file (treat as empty list). Relax ensureGiterloperRoot to not require pinned.yaml.

## Design

SESSION_PIN_NAME='_session' exported constant. validatePinName rejects trimmed === SESSION_PIN_NAME. resolvePin: validatePinName guard first, then if no pinName find pin by name SESSION_PIN_NAME or fail with message mentioning KNOWLEDGE_STORE_REMOTE. readPins: if !existsSync(pinnedPath) return []. doMutatePins: read existing or start from [] and ensureDir before writing.

## Acceptance Criteria

validatePinName('_session') throws. resolvePin(state, null) finds _session pin by name regardless of position. resolvePin fails with clear error when no _session pin exists even if other pins exist. readPins returns [] for missing file. All existing callers of validatePinName still work.

