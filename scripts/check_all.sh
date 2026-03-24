#!/usr/bin/env bash
# Run all repository checks: typecheck, spec path creep allowlist (concrete specs/*.md literals),
# and unified test harness. Delegates to check-all.ts so memsearch is bootstrapped on PATH when
# missing (no manual venv step). Allowlist for spec literals: scripts/check-spec-path-creep.ts.
set -e
cd "$(dirname "$0")/.."
exec deno run -A scripts/check-all.ts
