#!/usr/bin/env bash
# Optional: run the giterloper MCP server in Docker with local .giterloper mounted at /data.
# Use when you want parity with production (Fly.io). Dev and tests normally use native Deno.
# Matches Fly.io environment (CWD = /data, .giterloper on volume). From repo root:
#   ./scripts/run-docker.sh
# Optional: pass env (e.g. MCP_TOKEN) or --build to rebuild the image.
set -e
cd "$(dirname "$0")/.."
IMAGE_NAME="${GITERLOPER_DOCKER_IMAGE:-giterloper}"
if [[ "$1" == "--build" ]]; then
  docker build -t "$IMAGE_NAME" .
  shift
fi
mkdir -p .giterloper
docker run --rm -it \
  -v "$(pwd)/.giterloper:/data/.giterloper" \
  -p 3443:3443 \
  -e MCP_HOST=0.0.0.0 \
  -e MCP_PORT=3443 \
  "$@" \
  "$IMAGE_NAME"
