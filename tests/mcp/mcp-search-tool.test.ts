/**
 * E2E: giterloper_search over HTTP MCP with memsearch on PATH (see specs/MCP.md).
 * Formerly `reference_client/tests/client.test.ts` — "search returns results".
 */
import { assertEquals, assertExists, assertMatch } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";

import { newTestCliSessionId } from "../helpers/gl.ts";
import { createClient, search } from "../helpers/mcp-http-client.ts";
import {
  addTestPin,
  cleanupTestRepo,
  createRemoteBranch,
  ensurePinRemoved,
  randomPin,
} from "../helpers/mcp-remote-pin-fixtures.ts";
import { spawnMcpHttpIntegrationServer, waitForMcpHttpHealth } from "../helpers/mcp-subprocess.ts";

const SEARCH_SESSION = newTestCliSessionId();

function randomPort(): number {
  return 3450 + (randomBytes(2).readUInt16BE(0) % 500);
}

Deno.test({
  name: "search returns results",
  fn: async () => {
    const port = randomPort();
    const pinName = randomPin("search");
    const branch = `${pinName}-branch`;
    let server: ReturnType<typeof spawnMcpHttpIntegrationServer> | null = null;
    try {
      cleanupTestRepo({ pinName, branchName: branch, sessionId: SEARCH_SESSION });
      createRemoteBranch(branch, "knowledge/scratch.md", "# scratch\n\nContains marker search_test_xyz");
      addTestPin(
        pinName,
        branch,
        "knowledge/scratch.md",
        "# scratch\n\nContains marker search_test_xyz",
        SEARCH_SESSION
      );

      server = spawnMcpHttpIntegrationServer({ port, mcpStateSessionId: SEARCH_SESSION });
      await waitForMcpHttpHealth(port, 5000);

      const client = await createClient({
        url: `http://127.0.0.1:${port}/mcp`,
        requestTimeoutMs: 120000,
      });
      try {
        const result = await search(client, { pin: pinName, query: "search_test_xyz", limit: 5 });
        assertEquals(result.ok, true);
        assertEquals(result.pin, pinName);
        assertExists(result.effectiveSha);
        assertExists(result.results);
        assertEquals(result.results.length >= 1, true);
        const first = result.results[0] as { path?: string; snippet?: string };
        assertMatch(first.path ?? "", /scratch|knowledge/);
      } finally {
        await client.close();
      }
    } finally {
      server?.kill();
      ensurePinRemoved(pinName, SEARCH_SESSION);
      cleanupTestRepo({ pinName, branchName: branch, sessionId: SEARCH_SESSION });
    }
  },
});
