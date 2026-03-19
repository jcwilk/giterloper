---
id: git-92h3
status: closed
deps: [git-w1te, git-k1gj, git-ghgt, git-69p7]
links: []
created: 2026-03-17T06:12:20Z
type: task
priority: 1
assignee: user.email
parent: git-amoh
---
# Rewrite unit tests for _session pin semantics

Rewrite tests/unit/pinned.test.ts: update validatePinName tests to reject _session instead of default. Replace RESERVED_PIN_NAME import with SESSION_PIN_NAME. Test resolvePin finds _session pin by name regardless of position in list. Test resolvePin('_session') is rejected. Test resolvePin(null) fails when no _session pin exists even if other pins present. Test readPins returns [] for missing file. Rewrite tests/unit/mcp-pin-set.test.ts: update defaultPin assertions to sessionPin, update message assertions, add test that pin_set with pin '_session' is rejected. Check tests/unit/mcp-error-mapping.test.ts for any 'default' references.

## Acceptance Criteria

All unit tests pass. Tests cover: validatePinName rejects _session, resolvePin name-based lookup, resolvePin rejection of explicit _session, readPins missing file, pin_set sessionPin responses, pin_set _session rejection.

