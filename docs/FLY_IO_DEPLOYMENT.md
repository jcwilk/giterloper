# Deploying giterloper on Fly.io — deep dive

Research note for deploying the giterloper MCP server (Deno + git + Python memsearch + persistent `.giterloper/`) on Fly.io under the constraints in [DEPLOYMENT_REQUIREMENTS.md](./DEPLOYMENT_REQUIREMENTS.md): persistent disk, one Machine, inbound HTTP, outbound HTTPS, &lt;$20/month.

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

**Outline:**

- **Base:** Debian Bookworm (e.g. `debian:bookworm-slim`) or a Deno image that allows installing Python/git (e.g. `hayd/alpine-deno` plus Python/pip/git if available, or a multi-stage with Debian).
- **Install:** Deno (official install script or image), `git`, `python3`, `python3-pip`, then `pip install memsearch`. Ensure `memsearch` and `git` are on `PATH`.
- **App:** Copy repo (e.g. `COPY . /app`), `WORKDIR /app`.
- **Runtime:** Run the server with **CWD set to the volume** so `.giterloper` lives on persistent storage. The app uses `path.resolve(Deno.cwd())` as project root; therefore start the process from `/data`:

  ```dockerfile
  WORKDIR /app
  # Example entrypoint: run server with cwd = volume mount
  ENTRYPOINT ["/bin/sh", "-c"]
  CMD ["cd /data && exec deno run -A lib/gl-mcp-server.ts"]
  ```

  Or use an entrypoint script that `cd /data` then `exec deno run -A lib/gl-mcp-server.ts`. Do not rely on copying `.giterloper` into the image; the volume is mounted at runtime at `/data`.

**Minimal single-stage sketch:**

```dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git python3 python3-pip && \
    curl -fsSL https://deno.land/install.sh | sh && \
    mv /root/.deno/bin/deno /usr/local/bin/ && \
    pip3 install --break-system-packages memsearch && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
WORKDIR /data
EXPOSE 8080
CMD ["deno", "run", "-A", "/app/lib/gl-mcp-server.ts"]
```

Here `WORKDIR /data` makes `Deno.cwd()` equal `/data`, so `.giterloper` is created at `/data/.giterloper` on the volume. Expose the port the app will listen on (e.g. 8080 to match Fly’s `internal_port`).

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

  Optional: `MCP_SESSION_TTL_MS`. Do **not** set `MCP_INSECURE=true` in production.

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

**Deploy giterloper on Fly.io:** Create an app with `fly launch --no-deploy`, add to `fly.toml` a `[mounts]` section with `source = "giterloper_data"`, `destination = "/data"`, and `initial_size = "20gb"`. Use a Dockerfile that installs Deno, git, Python, and `pip install memsearch`, sets `WORKDIR /data` (or runs the server with CWD `/data`) so `.giterloper` lives on the volume, and exposes the MCP port (e.g. 8080). Set `[env]` for `MCP_HOST=0.0.0.0` and `MCP_PORT=8080`, set `MCP_TOKEN` and optionally `GITERLOPER_GH_TOKEN` with `fly secrets set`, set `[http_service] internal_port = 8080` and a health check to `/health`, add `[[vm]] size = "shared-cpu-1x"` and e.g. `memory = "512mb"`, then run `fly deploy` and `fly scale count 1`. Cost is roughly \$6–9/month for shared-cpu-1x + 20 GB volume. Fly provides TLS and public HTTP/HTTPS; the app listens on HTTP and uses Bearer auth via `MCP_TOKEN`.

**Minimal `fly.toml` outline:**

```toml
app = "giterloper"

[build]
  dockerfile = "Dockerfile"

[env]
  MCP_HOST = "0.0.0.0"
  MCP_PORT = "8080"

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
fly deploy
fly scale count 1
fly volumes list && fly machine list
```
