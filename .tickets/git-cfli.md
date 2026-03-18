---
id: git-cfli
status: closed
deps: []
links: []
created: 2026-03-18T23:00:56Z
type: task
priority: 1
assignee: user.email
parent: git-tsxe
---
# Make makeState() require session id; remove shared .giterloper/ code path

Core structural change. In lib/gl-core.ts: change makeState(sessionId?: string | null) to makeState(sessionId: string). Remove the else branch (lines 99-107) that returns non-session paths rooted at shared .giterloper/. Remove JSDoc on line 80 about CLI using makeState() without sessionId. Since sessionId is now always present, the if (!state.sessionId) return guards in ensureSessionDir (line 26) and autoInitSessionPin (line 37) become dead code — remove them. In lib/types.ts line 20: change sessionId?: string to sessionId: string.

## Design

makeState() takes a required string. All returned GlState objects have sessionId set and all paths rooted under .giterloper/sessions/<sessionId>/. The shared .giterloper/pinned.yaml path is structurally impossible to produce.

## Acceptance Criteria

makeState() with no argument does not compile. makeState('_cli') returns paths under .giterloper/sessions/_cli/. GlState.sessionId is required (not optional). deno check lib/gl.ts passes.

