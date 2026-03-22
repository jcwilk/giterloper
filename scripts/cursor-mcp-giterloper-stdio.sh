#!/usr/bin/env bash
# Cursor MCP stdio: bootstrap memsearch PATH via with-memsearch.ts; repo root from this script.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.deno/bin:${PATH:-}"
exec deno run -A "$ROOT/scripts/with-memsearch.ts" -- run -A --env-file="$ROOT/.env" "$ROOT/lib/gl-mcp-server-stdio.ts" "$@"
