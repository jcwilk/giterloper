#!/usr/bin/env bash
# Run all repository checks: typecheck, unit tests, E2E tests.
# Exits on first failure. Run from repository root.
set -e
cd "$(dirname "$0")/.."

echo "==> Typecheck (deno check lib/gl.ts)"
deno check lib/gl.ts

echo "==> Unit tests (deno test -A tests/unit/)"
deno test -A tests/unit/

echo "==> E2E tests (deno run -A scripts/run-e2e.ts)"
deno run -A scripts/run-e2e.ts

echo "==> All checks passed"
