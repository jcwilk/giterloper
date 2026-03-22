/**
 * Subprocess env for integration tests: supplies the test knowledge remote. Pair with **`--mcp-test-mode`**
 * on `gl`, `gl-maintenance`, and MCP entrypoints so session layout uses `.giterloper_test`.
 * Prefer **`runGl` / `runGlMaintenance`** (`tests/helpers/gl.ts`) or **`createMcpAppForTest`** (`lib/gl-mcp-server.ts`)
 * so integration tests do not reimplement this merge. See tests/README.md (MCP test mode / integration harness).
 */
import { TEST_KNOWLEDGE_STORE_REMOTE_ENV } from "../../lib/session-layout.ts";
import { TEST_SOURCE, toRemoteUrl } from "./config.ts";

/** Merged into gl / gl-maintenance child processes and documented for other spawns (e.g. MCP test servers via `mcp-subprocess.ts`). */
export function integrationMcpModeChildEnv(): Record<string, string> {
  return {
    [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: toRemoteUrl(TEST_SOURCE),
  };
}
