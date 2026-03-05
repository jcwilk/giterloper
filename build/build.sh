#!/usr/bin/env bash
# Build giterloper: assemble bootstrap dist files and generate README one-liners.
# Run from repo root. Reads giterloper.yaml; writes bootstrap/dist/*.md and README.md.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BOOT_SRC="$ROOT/bootstrap/source"
BOOT_DIST="$ROOT/bootstrap/dist"
CONFIG="$ROOT/giterloper.yaml"

# Parse giterloper.yaml (simple line-based)
get_config() {
  sed -n "s/^$1:[[:space:]]*//p" "$CONFIG" | sed 's/[[:space:]]*#.*//' | head -1
}
name=$(get_config name)
description=$(get_config description)
repo_url=$(get_config repo_url)
# Normalize repo_url: no trailing slash
repo_url="${repo_url%/}"
# Default branch for blob URLs
branch=main
if git -C "$ROOT" rev-parse --verify main &>/dev/null; then
  branch=main
elif git -C "$ROOT" rev-parse --verify master &>/dev/null; then
  branch=master
fi
# GitHub blob path: repo_url might be https://github.com/owner/repo
blob_base="${repo_url}/blob/${branch}/bootstrap/dist"

mkdir -p "$BOOT_DIST"

# Full interactive: 00 through 04
cat "$BOOT_SRC/00-preamble.md" \
    "$BOOT_SRC/01-installation.md" \
    "$BOOT_SRC/02-instructions-template.md" \
    "$BOOT_SRC/03-optional-infra.md" \
    "$BOOT_SRC/04-verification.md" \
    > "$BOOT_DIST/full.md"

# Lite interactive: same as full but drop the long example paragraph in 02
{
  cat "$BOOT_SRC/00-preamble.md" "$BOOT_SRC/01-installation.md"
  sed '/^Example opening paragraph/,/^$/d' "$BOOT_SRC/02-instructions-template.md" || true
  cat "$BOOT_SRC/03-optional-infra.md" "$BOOT_SRC/04-verification.md"
} > "$BOOT_DIST/lite.md"

# Non-interactive: 00 through 05 (includes contingency handling)
cat "$BOOT_SRC/00-preamble.md" \
    "$BOOT_SRC/01-installation.md" \
    "$BOOT_SRC/02-instructions-template.md" \
    "$BOOT_SRC/03-optional-infra.md" \
    "$BOOT_SRC/04-verification.md" \
    "$BOOT_SRC/05-non-interactive.md" \
    > "$BOOT_DIST/non-interactive.md"

# Generate README.md with one-liners from config
# One-liner pattern: "The {name} knowledge store contains knowledge about {description}. To install access..."
name_cap="$(echo "$name" | sed 's/^./\U&/')"
oneliner_full="The ${name_cap} knowledge store contains knowledge about ${description}. To install access so that agents working on your project can access that knowledge, read ${blob_base}/full.md and follow the instructions."
oneliner_lite="The ${name_cap} knowledge store contains knowledge about ${description}. To install access so that agents working on your project can access that knowledge, read ${blob_base}/lite.md and follow the instructions (lite variant for smaller context windows)."
oneliner_ni="The ${name_cap} knowledge store contains knowledge about ${description}. To install access so that agents working on your project can access that knowledge, read ${blob_base}/non-interactive.md and follow the instructions (non-interactive variant; no human in the loop)."

cat > "$ROOT/README.md" << README
# Giterloper

Git-backed knowledge storage: a long-term, incremental source of truth stored in a Git repository, with instructions at the root for how to read and write it. Structure is arbitrary; the instructions are the contract. Agents and tools use the same operations (answer from context, retrieve context, verify claims, add/subtract/intersect knowledge) across stores. All operations accept raw string or asset reference inputs. See [CONSTITUTION.md](CONSTITUTION.md) for the paradigm.

This repository is a giterloper knowledge store about giterloper itself.

## Install access to this knowledge store

Give your agent one of the following (choose by context window and whether you want interactive confirmation):

**Full (interactive):**  
${oneliner_full}

**Lite (interactive, smaller):**  
${oneliner_lite}

**Non-interactive:**  
${oneliner_ni}

## Constitution

The immutable core of the paradigm is [CONSTITUTION.md](CONSTITUTION.md). Verify a copy with [CONSTITUTION.md5](CONSTITUTION.md5). This repo is self-installed: see [.giterloper/constitution.md](.giterloper/constitution.md).
README

echo "Build done: bootstrap/dist/{full,lite,non-interactive}.md and README.md"
