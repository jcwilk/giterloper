/**
 * Subprocess env for integration tests: forces MCP test mode session layout (`.giterloper_test`) and the
 * test knowledge remote. Normative: specs/core.md, specs/MCP.md; see tests/README.md.
 */
import {
  GITERLOPER_MCP_TEST_MODE_ENV,
  TEST_KNOWLEDGE_STORE_REMOTE_ENV,
} from "../../lib/session-layout.ts";
import { TEST_SOURCE, toRemoteUrl } from "./config.ts";

/** Merged into gl / gl-maintenance child processes and documented for other spawns (e.g. reference_client). */
export function integrationMcpModeChildEnv(): Record<string, string> {
  return {
    [GITERLOPER_MCP_TEST_MODE_ENV]: "1",
    [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: toRemoteUrl(TEST_SOURCE),
  };
}
