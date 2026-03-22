#!/usr/bin/env bash
# Cursor MCP stdio launcher: ensure memsearch (venv) and deno are on PATH when the IDE
# spawns a minimal environment. Repo root is derived from this script location.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.venv/bin:${HOME}/.deno/bin:$PATH"
exec deno run -A --env-file="$ROOT/.env" "$ROOT/lib/gl-mcp-server-stdio.ts" "$@"
