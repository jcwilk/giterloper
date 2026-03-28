/**
 * Subprocess env for integration tests: supplies the test knowledge remote. Pair with **`--mcp-test-mode`**
 * on `gl`, `gl-maintenance`, and MCP entrypoints so session layout uses `.giterloper_test`.
 * Prefer **`runGl` / `runGlMaintenance`** (`tests/helpers/gl.ts`) or **`createMcpAppForTest`** (`lib/gl-mcp-server.ts`)
 * so integration tests do not reimplement this merge. See tests/README.md (MCP test mode / integration harness).
 */
import {
  GITERLOPER_MCP_TEST_SESSION_PARENT,
  TEST_KNOWLEDGE_STORE_REMOTE_ENV,
} from "../../lib/session-layout.ts";
import { TEST_SOURCE, toRemoteUrl } from "./config.ts";

/** Merged into gl / gl-maintenance child processes and documented for other spawns (e.g. MCP test servers via `mcp-subprocess.ts`). */
export function integrationMcpModeChildEnv(): Record<string, string> {
  const out: Record<string, string> = {
    [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: toRemoteUrl(TEST_SOURCE),
  };
  const sessionParent = Deno.env.get(GITERLOPER_MCP_TEST_SESSION_PARENT)?.trim();
  if (sessionParent) {
    out[GITERLOPER_MCP_TEST_SESSION_PARENT] = sessionParent;
  }
  return out;
}

/**
 * For `gl` / MCP child processes: default `GITERLOPER_OPENAI_VCR=replay-only` and a dummy
 * `OPENAI_API_KEY` when none is set so `integrateCorpusWithOpenAi` passes its gate while VCR replays tapes.
 */
export function applyOpenAiVcrChildDefaults(env: Record<string, string>): void {
  if (env.GITERLOPER_OPENAI_VCR === undefined) {
    env.GITERLOPER_OPENAI_VCR = "replay-only";
  }
  const vcrMode = (env.GITERLOPER_OPENAI_VCR ?? "").trim().toLowerCase();
  if (vcrMode !== "" && vcrMode !== "off" && !env.OPENAI_API_KEY?.trim() &&
    !env.GITERLOPER_RECONCILE_OPENAI_API_KEY?.trim()) {
    env.OPENAI_API_KEY = "sk-dummy-vcr-replay";
  }
}
