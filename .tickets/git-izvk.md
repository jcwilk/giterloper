---
id: git-izvk
status: open
deps: []
links: []
created: 2026-03-17T08:31:16Z
type: task
priority: 1
assignee: user.email
parent: git-6elj
---
# Define canonical pin_set contract and compatibility plan

Choose the canonical behavior for giterloper_pin_set (documented branch/ref configurator vs current default-pin selector) and document migration/compatibility constraints. Decide whether to evolve implementation to match docs or revise docs + tests to match intended product behavior. Capture explicit handling for omitted pin, reserved _session, and unsupported arguments.

## Acceptance Criteria

Decision record states canonical contract and backward-compatibility stance; explicit behavior matrix for pin/branch/ref and _session is approved; any required deprecation/error-code strategy is documented

