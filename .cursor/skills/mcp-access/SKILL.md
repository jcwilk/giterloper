---
name: mcp-access
description: Use only Cursor's local giterloper MCP interface (project-configured stdio MCP) for giterloper actions. Use when the user says /mcp-access or asks to validate MCP-only behavior, setup, limits, or agentic workflows without using CLI, HTTP/SSE, or cloud-hosted MCP paths.
---

# mcp-access

## Purpose

Disambiguate giterloper access mode and force MCP-only operation through Cursor's local MCP integration.

When this skill is active, use only MCP tool calls against the giterloper MCP server. Do not assume the server identifier—discover it first.

## Discovering the server identifier

The Cursor-provided giterloper MCP server identifier varies (e.g. `project-0-giterloper-giterloper`, `project-1-giterloper-giterloper`). Do not hardcode it.

To find the correct identifier:

1. List subdirectories under `~/.cursor/projects/home-user-workspace-giterloper/mcps/` (or the workspace-specific mcps path).
2. Find the folder whose name includes `giterloper` (e.g. `project-N-giterloper-giterloper`).
3. Read `SERVER_METADATA.json` in that folder; use its `serverIdentifier` value when calling MCP tools.

Use that `serverIdentifier` as the `server` argument in all MCP tool invocations.

## Hard Constraints

- Do not use the giterloper CLI (`./.cursor/skills/gl/scripts/gl ...`) for giterloper behavior.
- Do not run or call HTTP/SSE MCP endpoints.
- Do not use cloud-hosted or remote MCP routes for giterloper behavior.
- Do not edit `.giterloper/<sessionId>/pinned.yaml` directly to simulate tool behavior.
- If an operation is unavailable in exposed MCP tools, report that clearly instead of switching interfaces.

## MCP-Only Workflow

1. Discover the server identifier (see above).
2. Read MCP tool descriptors from the `tools/` subdirectory of the giterloper MCP folder (same folder that contains `SERVER_METADATA.json`).
3. Select the correct MCP tool based on descriptor `name` and `arguments`.
4. Invoke the tool via Cursor MCP with:
   - `server: "<serverIdentifier from SERVER_METADATA.json>"`
   - `toolName: "<descriptor name>"`
   - `arguments: { ... }`
5. Report result and limits precisely, including when the requested behavior is not exposed by MCP.

## Default Diagnostic Sequence

Use this sequence when testing MCP readiness or setup:

1. `giterloper_state_inspect` with `{}` to check session pin state.
2. If session state is missing/uninitialized, report the exact MCP error.
3. Continue only with operations supported by currently exposed MCP tools.

## Known Capability Boundary

If asked to add a pin through MCP-only access, verify descriptors and state explicitly and report capability limits. Current exposed tools may allow setting or inspecting pins but not creating new pins.

Do not workaround this boundary via CLI or file edits when this skill is active.
