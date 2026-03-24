# Giterloper deployment requirements

**Layering:** This file is **operational** guidance only. It must not be treated as the normative product contract. MCP transport, sessions, env semantics, and auth are defined in the **MCP** product slice (indexed in [specs/README.md](../specs/README.md)); [AGENTS.md](../AGENTS.md) summarizes **Where to read contracts**. On any mismatch, update this doc (see [HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](../HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)).

Consolidated from repo analysis and deployment discussion. Target: single-user hobby, under ~USD 20/month.

**Chosen platform:** Fly.io. See [FLY_IO_DEPLOYMENT.md](./FLY_IO_DEPLOYMENT.md) for step-by-step deployment. Run model: **production** uses Docker (image with Deno, git, Python, memsearch; persistent volume for `.giterloper/`). Development and tests use native Deno on the host (see [README.md](../README.md) and [AGENTS.md](../AGENTS.md)). Approximate cost: ~$6–9/month (small Machine + 20 GB volume).

---

## 1. File storage requirements

- **Root:** All session-scoped mutable state under `.giterloper/`. Each session has its own directory **named by session id** (no `sessions/` wrapper): **`.giterloper/<sessionId>/`**.
- **Layout (per session):** `<sessionId>/pinned.yaml`, `<sessionId>/versions/<pinName>/<sha>/` (git clones), `<sessionId>/staged/<pinName>/<branch>/` (working clones), `<sessionId>/indexes/<pinName>/<sha>/` (metadata.json + milvus.db), `<sessionId>/locks/pins/` (FIFO mutex, or equivalent session-local lock paths as implemented).
- **Writes:** Atomic overwrites (pinned.yaml), clone replace, git ops in staged/, memsearch writes milvus.db + metadata.json, session .last_activity, lock tickets (create/delete).
- **Scale (hobby):** Few pins, few sessions; size dominated by clones + staged + indexes. No hard limit; assume on the order of 10–20 GB is sufficient.

## 2. Runtime and subprocess requirements

- **Process:** Deno long-lived server (`deno run -A lib/gl-mcp-server.ts` or `deno task mcp:serve`). No minimum Deno version specified.
- **Required on PATH:** `git` (clone, fetch, push, checkout, rev-parse, ls-remote, etc.).
- **Required for search:** Python + `pip install memsearch`; `memsearch` CLI on PATH (invoked with `--milvus-uri <path>` to local milvus.db).
- **Optional:** `gh` CLI when GITERLOPER_GH_TOKEN is not set (for GitHub API token).
- **Other subprocesses:** `cp -r`, `rmdir` (POSIX). Node APIs: node:fs, node:path, node:child_process (spawnSync), node:crypto.
- **Docker (Fly.io):** The checked-in [`Dockerfile`](../Dockerfile) installs Deno (installer needs `curl`, `ca-certificates`, `unzip`), git, Python 3, pip, and `memsearch`, then copies only `deno.json`, `deno.lock`, and `lib/` into `/app` with runtime **`WORKDIR /data`** so `.giterloper/` lives on the mounted volume (not a full `COPY .` of the repository).

## 3. Memsearch and database requirements

- **No external DB server.** memsearch uses a **local file** (milvus.db) per pin+sha; path passed as `--milvus-uri`. SQLite-style usage.
- **Index dir:** One dir per (pinName, sha) with milvus.db + metadata.json. Build-on-demand supported.
- **Runtime:** memsearch CLI must be installed; giterloper only invokes it and passes the local DB path.

## 4. Network and environment requirements

- **Inbound:** HTTP on MCP_HOST:MCP_PORT (default 127.0.0.1:3443). Routes: `GET /health` (no auth), MCP over HTTP at `/mcp` (required methods and session headers per the **MCP** slice; CORS may surface `OPTIONS`). No TLS in-app; use reverse proxy in production. On Fly.io, bind to `0.0.0.0` and use the port Fly assigns (e.g. 8080) or set in env—[`fly.toml`](../fly.toml) uses 8080 with a `/health` check.
- **Outbound:** Git (HTTPS/SSH to pin repos: clone, fetch, push, ls-remote). GitHub API (api.github.com: commits, merges, refs) when pin source is GitHub. Optional: `gh auth token` if GITERLOPER_GH_TOKEN unset.
- **Env (spot-checked vs `lib/gl-mcp-server.ts`, `lib/mcp-session-store.ts`, `lib/gl-core.ts`):** `MCP_HOST`, `MCP_PORT`, `MCP_TOKEN` (Bearer), `MCP_INSECURE` (dev only), `MCP_SESSION_TTL_MS`; `GITERLOPER_GH_TOKEN` (optional, for git + GitHub API); **`KNOWLEDGE_STORE_REMOTE`** (**required** for normal MCP operation: non-empty valid Git remote; server exits at startup if missing/invalid). New sessions bootstrap `_session` from that remote at default branch HEAD before tools run (MCP slice). For MCP test mode (session root **`.giterloper_test`**), start the process with **`--mcp-test-mode`** and set **`TEST_KNOWLEDGE_STORE_REMOTE`** per the MCP slice and [tests/README.md](../tests/README.md)—not for production defaults.

## 5. Deploy and session behavior

- **Deploy replaces the process.** Session state is in-memory (MCP SDK transport). When the process is stopped or replaced (deploy, restart), all sessions are invalid; clients get "Session not found" (or connection errors) on the next request and must call `initialize` again to get a new session.
- **On-disk state persists** across deploys as long as the filesystem (e.g. Fly volume) is persistent: pinned.yaml, clones, staged, indexes, and session directories on disk survive; only the protocol sessions are lost.
- **No graceful shutdown today.** The server does not handle SIGTERM or drain in-flight requests; adding that would reduce mid-request failures but would not preserve session IDs across a restart.
- **Auto-deploy on push to main:** Use a GitHub Action that runs `fly deploy` on push to the main branch (or Fly’s “Deploy from GitHub” in the dashboard if available). Each deploy interrupts active sessions as above.

---

**Summary:** Persistent filesystem, Deno + git + Python/memsearch (Docker image on Fly.io), inbound HTTP, outbound HTTPS. Single user, low throughput, budget under ~USD 20/month. Deploy = replace process → sessions lost; auto-deploy via GitHub Action or Fly dashboard.
