# Giterloper MCP server: Deno, git, Python, memsearch. For Fly.io (volume at /data) or local run.
# See docs/FLY_IO_DEPLOYMENT.md and scripts/run-docker.sh.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    unzip \
    && curl -fsSL https://deno.land/install.sh | sh \
    && mv /root/.deno/bin/deno /usr/local/bin/ \
    && pip3 install --break-system-packages memsearch \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY deno.json deno.lock ./
COPY lib ./lib

# Runtime CWD must be the volume so .giterloper lives on persistent storage (Fly mount at /data).
WORKDIR /data
EXPOSE 8080
CMD ["deno", "run", "-A", "/app/lib/gl-mcp-server.ts"]
