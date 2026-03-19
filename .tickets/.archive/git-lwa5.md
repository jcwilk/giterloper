---
id: git-lwa5
status: closed
deps: []
links: []
created: 2026-03-16T10:37:28Z
type: task
priority: 2
assignee: user.email
parent: git-31wz
---
# Add Dockerfile for Fly.io deployment

Create a Dockerfile that: base image with Deno, git, Python, and memsearch (pip install memsearch); COPY app; set WORKDIR or CWD so .giterloper lives on mounted volume (e.g. /data); run deno task mcp:serve or deno run -A lib/gl-mcp-server.ts. Must work with Fly.io volume mount at /data and fly.toml mounts. Document in FLY_IO_DEPLOYMENT.md if needed.

## Acceptance Criteria

Dockerfile builds; fly deploy succeeds with volume at /data; MCP server starts and can serve /health and /mcp.

