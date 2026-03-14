# reference_client

Minimal external MCP client for giterloper. Exercises read, intake, and reconcile flows over MCP HTTP/SSE only.

## Constraints

- **No shared server core imports** — Client does not import from giterloper `lib/`. It is a truly external consumer.
- **MCP over HTTP/SSE** — All communication uses the MCP Streamable HTTP transport; no direct library calls.
- **Tests use relative `../` paths** — To run and target the local giterloper server, tests spawn the server as a subprocess and resolve paths relative to the workspace.

## Prerequisites

- Deno
- Giterloper MCP server running (or tests start it automatically)
- For E2E: push access to `github.com/jcwilk/giterloper_test_knowledge`, `GITERLOPER_GH_TOKEN` set

## Usage

### Run demo (server must be running)

```bash
# From reference_client/
deno run -A run.ts

# Or with custom URL
deno run -A run.ts http://127.0.0.1:3443/mcp
```

### Authentication

- **Local dev:** Start the giterloper server with `MCP_INSECURE=true` — no token required.
- **Token auth:** Set `MCP_TOKEN` in the environment; the client will send `Authorization: Bearer <token>`.

### Programmatic usage

```typescript
import {
  createClient,
  search,
  retrieve,
  stateInspect,
  insertPending,
  reconcilePending,
  reconcile,
} from "./client.ts";

const client = await createClient({
  url: "http://127.0.0.1:3443/mcp",
  token: Deno.env.get("MCP_TOKEN"),
});

// Read
const pins = await stateInspect(client);
const results = await search(client, { pin: "my_pin", query: "topic", limit: 10 });
const doc = await retrieve(client, { pin: "my_pin", path: "knowledge/foo.md" });

// Write (intake + reconcile)
await insertPending(client, { pin: "my_pin", content: "# New topic\n\nContent." });
await reconcilePending(client, { pin: "my_pin" });

// Merge
await reconcile(client, { sourcePin: "feature", targetPin: "main" });

await client.close();
```

## Tests

Tests spawn the giterloper MCP server via subprocess and use `giterloper_test_knowledge` for E2E scenarios.

```bash
# From reference_client/
deno test -A tests/

# From workspace root
deno test -A reference_client/tests/
```

**Note:** The search test is ignored when the `memsearch` binary is not installed. Install memsearch to exercise the `giterloper_search` tool.

## Tools exercised

| Tool | Purpose |
|------|---------|
| `giterloper_state_inspect` | List pins, verify clone health |
| `giterloper_search` | Search knowledge at pinned version |
| `giterloper_retrieve` | Retrieve content by path |
| `giterloper_insert_pending` | Queue knowledge into `knowledge/_pending/` |
| `giterloper_reconcile_pending` | Process pending into topic files |
| `giterloper_reconcile` | Merge source pin's branch into target via GitHub API |

See `docs/MCP_API_CONTRACT.md` in the giterloper repo for full schemas.
