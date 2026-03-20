#!/usr/bin/env bash
# Run all repository checks: typecheck and all topic test suites (core, cli, mcp).
# Exits on first failure. Run from repository root.
set -e
cd "$(dirname "$0")/.."

echo "==> Typecheck (deno check lib/gl.ts)"
deno check lib/gl.ts

echo "==> Tests (deno run -A scripts/run-tests.ts — see tests/README.md for harness / parallelism)"
deno run -A scripts/run-tests.ts

echo "==> All checks passed"
