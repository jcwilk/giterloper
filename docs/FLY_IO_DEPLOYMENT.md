# Deploying giterloper on Fly.io — deep dive

**Layering:** Operational runbook only; normative MCP behavior is [`specs/mcp.md`](../specs/mcp.md). If this text drifts from the contract or code, update this file ([HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](../HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)).

This document covers **production deployment** (Fly.io) and **optional local Docker run** when you want to match the container environment. For day-to-day development and tests, use **native Deno** on the host; see [README.md](../README.md) and [AGENTS.md](../AGENTS.md).

Research note for deploying the giterloper MCP server (Deno + git + Python memsearch + persistent `.giterloper/`) on Fly.io under the constraints in [DEPLOYMENT_REQUIREMENTS.md](./DEPLOYMENT_REQUIREMENTS.md): persistent disk, one Machine, inbound HTTP, outbound HTTPS, under ~USD 20/month. On-disk session layout under `.giterloper/` is **`<sessionId>/` directories only** (no `sessions/` wrapper)—see that doc for the full tree.

---

## 1. Creating a Fly app with a Volume (exact steps)

**Option A — New app (Fly Launch with volume)**

1. From the repo root:  
   `fly launch --no-deploy`  
   (Use `--dockerfile Dockerfile` if you have a custom Dockerfile; answer prompts for app name, region.)

2. Add a `[mounts]` section to the generated `fly.toml`:

   ```toml
   [mounts]
     source = "giterloper_data"
     destination = "/data"
     initial_size = "20gb"
   ```

   - **Mount path:** Use `destination = "/data"`. The app resolves `.giterloper` via `Deno.cwd()`, so the process must run with CWD `/data` (see Dockerfile outline below). Do not use `"/"` (not allowed).
   - **Size:** 10–20 GB. Set `initial_size = "20gb"` (or `"10gb"`); used when `fly launch` / `fly deploy` create a new volume. For existing apps where you add a volume manually, use `fly volumes create giterloper_data --region <region> -s 20`.

3. Create the volume in the app’s region (if not using `initial_size` on first deploy):  
   `fly volumes create giterloper_data -r <region> -s 20`  
   (Replace `<region>` with e.g. `iad`, `ord`, `ams` — must match `primary_region` or the region of your Machine.)

4. Deploy:  
   `fly deploy`

5. Ensure exactly one Machine:  
   `fly scale count 1`

6. Confirm:  
   `fly volumes list` and `fly machine list`; optionally `fly ssh console -s -C df` to see the volume mounted at `/data`.

**Option B — Existing app (add volume later)**

1. Add `[mounts]` to `fly.toml` as above (no `initial_size` if you create the volume by hand).
2. `fly status` to see the app’s region(s).
3. Create one volume per Machine in that region:  
   `fly volumes create giterloper_data -r <region> -s 20`
4. `fly deploy`
5. `fly scale count 1` if you want a single Machine.

**Important:** Volumes are **per-Machine** and **per-region**. One Machine → one volume with the same `source` name in that region. You cannot share one volume across Machines.

---

## 2. Dockerfile: Deno, git, Python, memsearch

Build happens on Fly (or locally); the **volume is not available at build time** — only at Machine start. Install all runtime deps in the image; use the mounted volume only at runtime.

**Authoritative image in this repo:** the root [`Dockerfile`](../Dockerfile) (compared for this audit) does the following:

- **Base:** `debian:bookworm-slim`.
- **Packages:** `ca-certificates`, `curl`, `git`, `python3`, `python3-pip`, **`unzip`** (required by Deno’s install script), then Deno via `deno.land/install.sh`, `pip3 install --break-system-packages memsearch`.
- **App payload:** copies **`deno.json`**, **`deno.lock`**, and **`lib/`** into `/app` only—not a full `COPY .` of the repository (tests, `.cursor/`, etc. are not in the production image).
- **Runtime:** `WORKDIR /data` then `EXPOSE 8080` and `CMD ["deno", "run", "-A", "/app/lib/gl-mcp-server.ts"]` so `Deno.cwd()` is `/data` and `.giterloper` is created at `/data/.giterloper` on the Fly volume.

Do not rely on baking `.giterloper` into the image; the volume is attached at Machine start. If you fork the Dockerfile, keep **CWD on the mount** (`/data` here) aligned with [`fly.toml`](../fly.toml) `[mounts].destination`.

---

## 3. Pricing (shared-cpu-1x + 20 GB volume, USD/month)

- **Compute:** Fly prices **started** Machines by preset and region. For **shared-cpu-1x** (per [Fly pricing](https://fly.io/docs/about/pricing/)), examples (≈30 days):  
  - 256MB: ~\$2.02 (e.g. ams), 512MB: ~\$3.32, 1GB: ~\$5.92.  
  Slightly lower in some regions (e.g. ~\$1.94 for 256MB in cdg).
- **Volume:** **\$0.15/GB/month** (pro-rated hourly). 20 GB ⇒ **\$3.00/month**.
- **Total (e.g. ams):** shared-cpu-1x 512MB + 20 GB volume ⇒ **~\$6.30/month**; 1GB + 20 GB ⇒ **~\$9/month**. Well under \$20. Volume snapshots (default 5-day retention) are billed separately from Jan 2026 (\$0.08/GB/month, first 10 GB free).

Use `fly platform vm-sizes` and the [pricing page](https://fly.io/docs/about/pricing/) for your chosen region.

---

## 4. Environment variables and secrets

- **Non-sensitive:** Set in `fly.toml`:

  ```toml
  [env]
    MCP_HOST = "0.0.0.0"
    MCP_PORT = "8080"
  ```

  Use `MCP_HOST=0.0.0.0` so the server listens on all interfaces for Fly’s proxy. Use the same port as `[http_service] internal_port` (e.g. 8080).

- **Sensitive:** Set via **secrets** (injected as env vars at Machine start, not stored in config):

  ```bash
  fly secrets set MCP_TOKEN="<bearer-token>"
  fly secrets set GITERLOPER_GH_TOKEN="<github-token>"
  ```

  Optional: `MCP_SESSION_TTL_MS`. **Required (non-secret):** set **`KNOWLEDGE_STORE_REMOTE`** (e.g. `https://github.com/owner/repo`) in `[env]` or via `fly secrets set`—the MCP server **exits at startup** if it is unset, empty, or not a valid remote URL. That remote is the sole knowledge-store identity for the server; each new HTTP MCP session bootstraps **`_session`** at the remote’s default branch HEAD before any tool runs—see [`specs/mcp.md`](../specs/mcp.md). Do **not** set `MCP_INSECURE=true` in production.

  **Harness / automation only:** to run an MCP-like stack with session state under **`.giterloper_test`**, run the MCP entrypoint with **`--mcp-test-mode`** and set **`TEST_KNOWLEDGE_STORE_REMOTE`** (see [`tests/README.md`](../tests/README.md)). Do not use test mode for production Fly apps.

- **Apply:** Redeploy to pick up secret changes: `fly deploy` (or `fly secrets deploy` to deploy without rebuilding).

---

## 5. Gotchas and constraints

- **Volume not available at build:** The volume is attached when the Machine starts, not during `docker build`. Do not COPY or RUN anything that assumes `/data` or `.giterloper` exists in the image; only the running process should use `/data` (the mount).
- **Single Machine only:** For one persistent volume and one app instance, use **one Machine**: `fly scale count 1`. Volumes are local to a Machine; scaling to multiple Machines would require multiple volumes (one per Machine) and the app is not designed for multi-Machine shared state.
- **Region:** Create the volume in the **same region** as the Machine. Set `primary_region` in `fly.toml` and create the volume with `-r <primary_region>`. Pick a region close to you or your users; pricing can vary slightly by region.
- **First mount empties destination:** The first time a volume is mounted at `destination`, the directory’s existing contents are replaced by the volume (empty or new). So `/data` will be empty on first boot; the app will create `.giterloper` there.
- **Cannot mount at `/`:** `destination` cannot be `/`; use a subdirectory (e.g. `/data`).
- **release_command has no volume:** `[deploy] release_command` runs in a temporary Machine **without** volumes. Do not use it for migrations or setup that need access to `/data`; do that in CMD/ENTRYPOINT or a startup script that runs when the main Machine starts.
- **Health check:** Configure `[[http_service.checks]]` with `path = "/health"` (and optional `method = "GET"`) so Fly can hit the unauthenticated health endpoint.

---

## 6. One-paragraph summary and minimal config

**Deploy giterloper on Fly.io:** Create an app with `fly launch --no-deploy`, add to `fly.toml` a `[mounts]` section with `source = "giterloper_data"`, `destination = "/data"`, and `initial_size = "20gb"`. Use a Dockerfile that installs Deno, git, Python, and `pip install memsearch`, sets `WORKDIR /data` (or runs the server with CWD `/data`) so `.giterloper` lives on the volume, and exposes the MCP port (e.g. 8080). Set `[env]` for `MCP_HOST=0.0.0.0`, `MCP_PORT=8080`, and **`KNOWLEDGE_STORE_REMOTE=<your knowledge repo HTTPS URL>`** (required—the server will not start without a valid remote). Set `MCP_TOKEN` and optionally `GITERLOPER_GH_TOKEN` with `fly secrets set`, set `[http_service] internal_port = 8080` and a health check to `/health`, add `[[vm]] size = "shared-cpu-1x"` and e.g. `memory = "512mb"`, then run `fly deploy` and `fly scale count 1`. Cost is roughly \$6–9/month for shared-cpu-1x + 20 GB volume. Fly provides TLS and public HTTP/HTTPS; the app listens on HTTP and uses Bearer auth via `MCP_TOKEN`.

**Minimal `fly.toml` outline:**

```toml
app = "giterloper"

[build]
  dockerfile = "Dockerfile"

[env]
  MCP_HOST = "0.0.0.0"
  MCP_PORT = "8080"
  KNOWLEDGE_STORE_REMOTE = "https://github.com/owner/your-knowledge-repo"

[mounts]
  source = "giterloper_data"
  destination = "/data"
  initial_size = "20gb"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "5s"
```

**Key commands:**

```bash
fly launch --no-deploy
# edit fly.toml (mounts, env, vm, http_service, health check)
fly secrets set MCP_TOKEN="<token>"
fly secrets set GITERLOPER_GH_TOKEN="<token>"   # optional
# KNOWLEDGE_STORE_REMOTE: set in [env] above or via fly secrets set — required for MCP startup
fly deploy
fly scale count 1
fly volumes list && fly machine list
```

---

## 7. Local Docker run (optional)

Optional: run the same image locally with your `.giterloper` directory persisted on the host when you want parity with production. Day-to-day dev uses native Deno (see README.md).

1. From the repo root, build and run:
   ```bash
   ./scripts/run-docker.sh --build
   ```
   Or run without rebuilding: `./scripts/run-docker.sh`.

2. The script ([`scripts/run-docker.sh`](../scripts/run-docker.sh)—compared for this audit) mounts `$(pwd)/.giterloper` at `/data/.giterloper`, publishes host port **3443** to container port **3443**, and sets `MCP_HOST=0.0.0.0` and `MCP_PORT=3443`. The container **must** receive **`KNOWLEDGE_STORE_REMOTE`** (and usually `MCP_TOKEN`); the server exits at startup if the knowledge remote is missing or invalid. Example:
   ```bash
   ./scripts/run-docker.sh -e KNOWLEDGE_STORE_REMOTE=https://github.com/owner/repo -e MCP_TOKEN=your-token -e GITERLOPER_GH_TOKEN=your-gh-token
   ```

3. Health: `curl http://localhost:3443/health`. MCP endpoint: `http://localhost:3443/mcp` (Bearer token required unless `MCP_INSECURE=true`).
