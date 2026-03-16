# Giterloper deployment requirements

Consolidated from repo analysis and deployment discussion. Target: single-user hobby, &lt;$20/month.

**Chosen platform:** Fly.io. See [FLY_IO_DEPLOYMENT.md](./FLY_IO_DEPLOYMENT.md) for step-by-step deployment. Run model: Docker (image with Deno, git, Python, memsearch; persistent volume for `.giterloper/`). Approximate cost: ~$6–9/month (small Machine + 20 GB volume).

---

## 1. File storage requirements

- **Root:** All state under `.giterloper/` (or session-scoped `.giterloper/sessions/<sessionId>/`).
- **Layout:** `pinned.yaml`, `versions/<pinName>/<sha>/` (git clones), `staged/<pinName>/<branch>/` (working clones), `indexes/<pinName>/<sha>/` (metadata.json + milvus.db), `sessions/<sessionId>/`, `locks/pins/` (FIFO mutex).
- **Writes:** Atomic overwrites (pinned.yaml), clone replace, git ops in staged/, memsearch writes milvus.db + metadata.json, session .last_activity, lock tickets (create/delete).
- **Scale (hobby):** Few pins, few sessions; size dominated by clones + staged + indexes. No hard limit; assume &lt;10–20 GB sufficient.

## 2. Runtime and subprocess requirements

- **Process:** Deno long-lived server (`deno run -A lib/gl-mcp-server.ts` or `deno task mcp:serve`). No minimum Deno version specified.
- **Required on PATH:** `git` (clone, fetch, push, checkout, rev-parse, ls-remote, etc.).
- **Required for search:** Python + `pip install memsearch`; `memsearch` CLI on PATH (invoked with `--milvus-uri <path>` to local milvus.db).
- **Optional:** `gh` CLI when GITERLOPER_GH_TOKEN is not set (for GitHub API token).
- **Other subprocesses:** `cp -r`, `rmdir` (POSIX). Node APIs: node:fs, node:path, node:child_process (spawnSync), node:crypto.
- **Docker (Fly.io):** The image must include Deno, git, Python, and memsearch; the app runs with CWD on the mounted volume so `.giterloper/` is persistent.

## 3. Memsearch and database requirements

- **No external DB server.** memsearch uses a **local file** (milvus.db) per pin+sha; path passed as `--milvus-uri`. SQLite-style usage.
- **Index dir:** One dir per (pinName, sha) with milvus.db + metadata.json. Build-on-demand supported.
- **Runtime:** memsearch CLI must be installed; giterloper only invokes it and passes the local DB path.

## 4. Network and environment requirements

- **Inbound:** HTTP on MCP_HOST:MCP_PORT (default 127.0.0.1:3443). Routes: `GET /health` (no auth), `GET/POST/DELETE/OPTIONS /mcp` (auth unless MCP_INSECURE). No TLS in-app; use reverse proxy in production. On Fly.io, bind to `0.0.0.0` and use the port Fly assigns (e.g. 8080) or set in env.
- **Outbound:** Git (HTTPS/SSH to pin repos: clone, fetch, push, ls-remote). GitHub API (api.github.com: commits, merges, refs) when pin source is GitHub. Optional: `gh auth token` if GITERLOPER_GH_TOKEN unset.
- **Env:** MCP_HOST, MCP_PORT, MCP_TOKEN (Bearer), MCP_INSECURE (dev only), MCP_SESSION_TTL_MS; GITERLOPER_GH_TOKEN (optional, for git + GitHub API).

## 5. Deploy and session behavior

- **Deploy replaces the process.** Session state is in-memory (MCP SDK transport). When the process is stopped or replaced (deploy, restart), all sessions are invalid; clients get "Session not found" (or connection errors) on the next request and must call `initialize` again to get a new session.
- **On-disk state persists** across deploys as long as the filesystem (e.g. Fly volume) is persistent: pinned.yaml, clones, staged, indexes, and session directories on disk survive; only the protocol sessions are lost.
- **No graceful shutdown today.** The server does not handle SIGTERM or drain in-flight requests; adding that would reduce mid-request failures but would not preserve session IDs across a restart.
- **Auto-deploy on push to main:** Use a GitHub Action that runs `fly deploy` on push to the main branch (or Fly’s “Deploy from GitHub” in the dashboard if available). Each deploy interrupts active sessions as above.

---

**Summary:** Persistent filesystem, Deno + git + Python/memsearch (Docker image on Fly.io), inbound HTTP, outbound HTTPS. Single user, low throughput, budget &lt;$20/month. Deploy = replace process → sessions lost; auto-deploy via GitHub Action or Fly dashboard.
