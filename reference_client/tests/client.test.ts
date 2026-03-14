/**
 * E2E tests for reference_client. Spawns local giterloper MCP server via subprocess.
 * Uses relative ../ paths to workspace. No lib/ imports.
 */
import { assertEquals, assertExists, assertMatch } from "jsr:@std/assert";
import {
  addTestPin,
  cleanupTestRepo,
  createRemoteBranch,
  ensurePinRemoved,
  hasMemsearch,
  randomPin,
  startServer,
  waitForServer,
  CLEAN_MAIN_SHA,
  TEST_SOURCE,
} from "../test_helpers.ts";
import {
  createClient,
  insertPending,
  reconcile,
  reconcilePending,
  retrieve,
  search,
  stateInspect,
} from "../client.ts";

const TEST_PORT = 3451;

Deno.test("state_inspect lists pins", async () => {
  const pinName = randomPin("inspect");
  const branch = `${pinName}-branch`;
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName, branchName: branch });
    createRemoteBranch(branch, "knowledge/scratch.md", "# scratch");
    addTestPin(pinName, branch, "knowledge/scratch.md", "# scratch");

    server = startServer(TEST_PORT);
    await waitForServer(TEST_PORT);

    const client = await createClient({
      url: `http://127.0.0.1:${TEST_PORT}/mcp`,
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
    ensurePinRemoved(pinName);
    cleanupTestRepo({ pinName, branchName: branch });
  }
});

Deno.test({
  name: "search returns results",
  ignore: !hasMemsearch(),
  fn: async () => {
  const pinName = randomPin("search");
  const branch = `${pinName}-branch`;
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName, branchName: branch });
    createRemoteBranch(branch, "knowledge/scratch.md", "# scratch\n\nContains marker search_test_xyz");
    addTestPin(pinName, branch, "knowledge/scratch.md", "# scratch\n\nContains marker search_test_xyz");

    server = startServer(TEST_PORT);
    await waitForServer(TEST_PORT);

    const client = await createClient({
      url: `http://127.0.0.1:${TEST_PORT}/mcp`,
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
    ensurePinRemoved(pinName);
    cleanupTestRepo({ pinName, branchName: branch });
  }
}});

Deno.test("retrieve returns file content", async () => {
  const pinName = randomPin("retrieve");
  const branch = `${pinName}-branch`;
  const content = "# Test doc\n\nretrieve_content_marker_abc";
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName, branchName: branch });
    createRemoteBranch(branch, "knowledge/scratch.md", content);
    addTestPin(pinName, branch, "knowledge/scratch.md", content);

    server = startServer(TEST_PORT);
    await waitForServer(TEST_PORT);

    const client = await createClient({
      url: `http://127.0.0.1:${TEST_PORT}/mcp`,
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
    ensurePinRemoved(pinName);
    cleanupTestRepo({ pinName, branchName: branch });
  }
});

Deno.test("insert_pending and reconcile_pending flow", async () => {
  const pinName = randomPin("insert");
  const branch = `${pinName}-branch`;
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName, branchName: branch });
    createRemoteBranch(branch, "knowledge/scratch.md", "# scratch");
    addTestPin(pinName, branch, "knowledge/scratch.md", "# scratch");

    server = startServer(TEST_PORT);
    await waitForServer(TEST_PORT);

    const client = await createClient({
      url: `http://127.0.0.1:${TEST_PORT}/mcp`,
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
    ensurePinRemoved(pinName);
    cleanupTestRepo({ pinName, branchName: branch });
  }
});

Deno.test("reconcile merges source into target", async () => {
  const sourcePin = randomPin("merge-src");
  const targetPin = randomPin("merge-tgt");
  const sourceBranch = `${sourcePin}-branch`;
  const targetBranch = `${targetPin}-branch`;
  let server: ReturnType<typeof startServer> | null = null;
  try {
    cleanupTestRepo({ pinName: sourcePin, branchName: sourceBranch });
    cleanupTestRepo({ pinName: targetPin, branchName: targetBranch });
    createRemoteBranch(sourceBranch, "knowledge/src.md", "# source");
    createRemoteBranch(targetBranch, "knowledge/tgt.md", "# target");
    addTestPin(sourcePin, sourceBranch, "knowledge/src.md", "# source");
    addTestPin(targetPin, targetBranch, "knowledge/tgt.md", "# target");

    server = startServer(TEST_PORT);
    await waitForServer(TEST_PORT);

    const client = await createClient({
      url: `http://127.0.0.1:${TEST_PORT}/mcp`,
    });
    try {
      const result = await reconcile(client, {
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
    ensurePinRemoved(sourcePin);
    ensurePinRemoved(targetPin);
    cleanupTestRepo({ pinName: sourcePin, branchName: sourceBranch });
    cleanupTestRepo({ pinName: targetPin, branchName: targetBranch });
  }
});
