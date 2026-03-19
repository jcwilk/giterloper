---
id: git-jrf9
status: closed
deps: [git-lwa5]
links: []
created: 2026-03-16T10:37:31Z
type: task
priority: 2
assignee: user.email
parent: git-31wz
---
# Document or add script for local Docker run

After Dockerfile exists: add a way to run giterloper via Docker locally (e.g. docker run with volume mount for .giterloper, or docker-compose.yml, or script in scripts/). Ensures local dev/run matches Fly.io environment. Optional: document in README or AGENTS.md.

## Acceptance Criteria

Docs or script allow running the same image locally with persistent .giterloper; no requirement to change default deno task mcp:serve for developers who prefer non-Docker.

