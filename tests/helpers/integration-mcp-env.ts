/**
 * Subprocess env for integration tests: supplies the test knowledge remote. Pair with **`--mcp-test-mode`**
 * on `gl`, `gl-maintenance`, and MCP entrypoints so session layout uses `.giterloper_test`. See tests/README.md.
 */
import { TEST_KNOWLEDGE_STORE_REMOTE_ENV } from "../../lib/session-layout.ts";
import { TEST_SOURCE, toRemoteUrl } from "./config.ts";

/** Merged into gl / gl-maintenance child processes and documented for other spawns (e.g. reference_client). */
export function integrationMcpModeChildEnv(): Record<string, string> {
  return {
    [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: toRemoteUrl(TEST_SOURCE),
  };
}
