#!/usr/bin/env bash
# Run all repository checks: typecheck and unified test harness.
# Delegates to check-all.ts so memsearch is bootstrapped on PATH when missing (no manual venv step).
set -e
cd "$(dirname "$0")/.."
exec deno run -A scripts/check-all.ts
