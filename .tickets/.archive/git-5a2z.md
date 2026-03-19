---
id: git-5a2z
status: closed
deps: [git-w1te]
links: []
created: 2026-03-17T06:12:14Z
type: task
priority: 1
assignee: user.email
parent: git-amoh
---
# Update CLI and pin-lifecycle callers for _session semantics

Update error messages in lib/gl.ts, lib/gl-maintenance.ts, lib/pin-lifecycle.ts to reference _session and KNOWLEDGE_STORE_REMOTE. All validatePinName call sites stay as-is (they correctly reject _session). gl pin add _session is rejected. The _session pin for CLI is created through a dedicated init path or internal code that bypasses validatePinName. Update resolvePin error messages to mention KNOWLEDGE_STORE_REMOTE env var.

## Acceptance Criteria

CLI commands that omit pin resolve to _session by name. gl pin add _session is rejected. Error messages mention _session and KNOWLEDGE_STORE_REMOTE. validatePinName calls remain at all existing sites.

