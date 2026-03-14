---
id: git-893e
status: open
deps: [git-j6xv, git-6ens]
links: []
created: 2026-03-14T19:02:49Z
type: feature
priority: 1
assignee: user.email
parent: git-mowe
---
# Build rudimentary topic-first reconciliation workflow

Implement an agent-assisted reconciliation operation that integrates pending knowledge into canonical topic-based files under knowledge/, then clears processed pending files safely.

## Design

Capture the spirit of prior filing skill: process pending files in commit order, synthesize by subject/topic (not source filename), merge overlap into existing topic files, strip boilerplate/repetition, preserve key citations/links, add a Sources section, and add relative cross-links among related files. Permit limited restructuring with auditable summaries. Delete pending files only after content is represented.

## Acceptance Criteria

- Reconcile operation reads pending set and produces topic-oriented canonical updates.\n- Sources attribution is present in updated/new topic files.\n- Pending files are removed only after successful representation.\n- Operation returns oldSha/newSha and touched-file summary.\n- Initial implementation is intentionally rudimentary but deterministic and auditable.

