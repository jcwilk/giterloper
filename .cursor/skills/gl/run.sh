#!/usr/bin/env bash
# Thin wrapper: runs the gl CLI via Deno. Invoke from workspace root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec deno run -A "$ROOT/lib/gl.ts" "$@"
