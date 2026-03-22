/**
 * E2E tests for reference_client. Spawns local giterloper MCP server via subprocess.
 * Uses relative ../ paths to workspace. No lib/ imports.
 */
import { assertEquals, assertExists, assertMatch } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import {
  addTestPin,
  cleanupTestRepo,
  createRemoteBranch,
  ensurePinRemoved,
  newTestCliSessionId,
  randomPin,
  startServer,
  waitForServer,
} from "../test_helpers.ts";

/** One session id per test file — avoids `_cli` contention when `deno test` runs multiple files in parallel; see `tests/README.md` for full-suite concurrency and `.giterloper/<sessionId>/` target layout. */
const RC_SESSION = newTestCliSessionId();
import {
  createClient,
  insertPending,
  merge,
  reconcilePending,
  retrieve,
  search,
  stateInspect,
} from "../client.ts";

function randomPort(): number {
  return 3450 + (randomBytes(2).readUInt16BE(0) % 500);
}

Deno.test({ name: "state_inspect lists pins", fn: async () => {
  const port = randomPort();
  const pinName = randomPin("inspect");
  const branch = `${pinName}-branch`;
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
    createRemoteBranch(branch, "knowledge/scratch.md", "# scratch");
    addTestPin(pinName, branch, "knowledge/scratch.md", "# scratch", RC_SESSION);

    server = startServer(port, RC_SESSION);
    await waitForServer(port);

    const client = await createClient({
      url: `http://127.0.0.1:${port}/mcp`,
      requestTimeoutMs: 120000,
    });
    try {
      const result = await stateInspect(client);
      assertEquals(result.ok, true);
      assertExists(result.pins);
      const pin = (result.pins as { name?: string }[]).find((p) => p.name === pinName);
      assertExists(pin);
      assertEquals((pin as { name: string }).name, pinName);
    } finally {
      await client.close();
    }
  } finally {
    server?.kill();
    ensurePinRemoved(pinName, RC_SESSION);
    cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
  }
}});

/** Assumes `memsearch` on PATH; MCP and this suite require it ([specs/MCP.md](../specs/MCP.md)). */
Deno.test({
  name: "search returns results",
  fn: async () => {
    const port = randomPort();
    const pinName = randomPin("search");
    const branch = `${pinName}-branch`;
    let server: ReturnType<typeof startServer> | null = null;
    try {
      cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
      createRemoteBranch(branch, "knowledge/scratch.md", "# scratch\n\nContains marker search_test_xyz");
      addTestPin(pinName, branch, "knowledge/scratch.md", "# scratch\n\nContains marker search_test_xyz", RC_SESSION);

      server = startServer(port, RC_SESSION);
      await waitForServer(port);

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
      ensurePinRemoved(pinName, RC_SESSION);
      cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
    }
  },
});

Deno.test({ name: "retrieve returns file content", fn: async () => {
  const port = randomPort();
  const pinName = randomPin("retrieve");
  const branch = `${pinName}-branch`;
  const content = "# Test doc\n\nretrieve_content_marker_abc";
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
    createRemoteBranch(branch, "knowledge/scratch.md", content);
    addTestPin(pinName, branch, "knowledge/scratch.md", content, RC_SESSION);

    server = startServer(port, RC_SESSION);
    await waitForServer(port);

    const client = await createClient({
      url: `http://127.0.0.1:${port}/mcp`,
      requestTimeoutMs: 120000,
    });
    try {
      const result = await retrieve(client, {
        pin: pinName,
        path: "knowledge/scratch.md",
      });
      assertEquals(result.ok, true);
      assertEquals(result.pin, pinName);
      assertMatch(result.content, /retrieve_content_marker_abc/);
    } finally {
      await client.close();
    }
  } finally {
    server?.kill();
    ensurePinRemoved(pinName, RC_SESSION);
    cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
  }
}});

Deno.test({ name: "insert_pending and reconcile_pending flow", fn: async () => {
  const port = randomPort();
  const pinName = randomPin("insert");
  const branch = `${pinName}-branch`;
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
    createRemoteBranch(branch, "knowledge/scratch.md", "# scratch");
    addTestPin(pinName, branch, "knowledge/scratch.md", "# scratch", RC_SESSION);

    server = startServer(port, RC_SESSION);
    await waitForServer(port);

    const client = await createClient({
      url: `http://127.0.0.1:${port}/mcp`,
      requestTimeoutMs: 120000,
    });
    try {
      const insertResult = await insertPending(client, {
        pin: pinName,
        content: "# Intake Topic\n\ninsert_reconcile_marker_def",
      });
      assertEquals(insertResult.ok, true);
      assertEquals(insertResult.action, "inserted");
      assertExists(insertResult.oldSha);
      assertExists(insertResult.newSha);
      assertEquals(insertResult.oldSha !== insertResult.newSha, true);

      const reconcileResult = await reconcilePending(client, { pin: pinName });
      assertEquals(reconcileResult.ok, true);
      assertEquals(reconcileResult.action, "reconciled");
      assertExists(reconcileResult.touched);
      assertEquals(reconcileResult.touched.length >= 1, true);
    } finally {
      await client.close();
    }
  } finally {
    server?.kill();
    ensurePinRemoved(pinName, RC_SESSION);
    cleanupTestRepo({ pinName, branchName: branch, sessionId: RC_SESSION });
  }
}});

Deno.test({ name: "merge merges source into target", fn: async () => {
  const port = randomPort();
  const sourcePin = randomPin("merge-src");
  const targetPin = randomPin("merge-tgt");
  const sourceBranch = `${sourcePin}-branch`;
  const targetBranch = `${targetPin}-branch`;
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName: sourcePin, branchName: sourceBranch, sessionId: RC_SESSION });
    cleanupTestRepo({ pinName: targetPin, branchName: targetBranch, sessionId: RC_SESSION });
    createRemoteBranch(sourceBranch, "knowledge/src.md", "# source");
    createRemoteBranch(targetBranch, "knowledge/tgt.md", "# target");
    addTestPin(sourcePin, sourceBranch, "knowledge/src.md", "# source", RC_SESSION);
    addTestPin(targetPin, targetBranch, "knowledge/tgt.md", "# target", RC_SESSION);

    server = startServer(port, RC_SESSION);
    await waitForServer(port);

    const client = await createClient({
      url: `http://127.0.0.1:${port}/mcp`,
      requestTimeoutMs: 120000,
    });
    try {
      const result = await merge(client, {
        sourcePin,
        targetPin,
      });
      assertEquals(result.ok, true);
      assertEquals(result.action, "merged");
      assertEquals(result.source.pin, sourcePin);
      assertEquals(result.target.pin, targetPin);
      assertExists(result.target.oldSha);
      assertExists(result.target.newSha);
    } finally {
      await client.close();
    }
  } finally {
    server?.kill();
    ensurePinRemoved(sourcePin, RC_SESSION);
    ensurePinRemoved(targetPin, RC_SESSION);
    cleanupTestRepo({ pinName: sourcePin, branchName: sourceBranch, sessionId: RC_SESSION });
    cleanupTestRepo({ pinName: targetPin, branchName: targetBranch, sessionId: RC_SESSION });
  }
}});
