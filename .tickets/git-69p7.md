---
id: git-69p7
status: open
deps: [git-w1te, git-ghgt]
links: []
created: 2026-03-17T06:11:58Z
type: task
priority: 1
assignee: user.email
parent: git-amoh
---
# Rewrite pin_set handler around _session concept

Rewrite the giterloper_pin_set handler in gl-mcp-server.ts. The pin parameter is validated by validatePinName (rejects _session). Key paths: (1) No pin + no modifiers: view the _session pin, error if not configured. (2) No pin + source (optionally ref/branch): create or update _session pin with fresh SHA from API. (3) No pin + branch only: update existing _session pin's branch, eager push. (4) Named pin: upsert as before but inherit source/sha from _session pin (not pins[0]). Response field: defaultPin -> sessionPin. Messages: 'session default' -> 'session pin'.

## Design

validatePinName(pin) at top of handler rejects _session. No-pin paths operate on the pin named SESSION_PIN_NAME internally. Named-pin inheritance uses the _session pin found by name. Response field renamed to sessionPin.

## Acceptance Criteria

pin_set with no pin views/creates/updates the _session pin. pin_set with pin: '_session' is rejected. pin_set with named pin inherits from _session pin not pins[0]. Responses use sessionPin field. Branch-only path eager-pushes.

