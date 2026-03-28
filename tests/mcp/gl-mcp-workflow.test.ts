/**
 * MCP integration workflow: session-driven, minimal setup (higher-level agent path).
 * Uses `--mcp-test-mode` + `integrationMcpModeChildEnv()` (`TEST_KNOWLEDGE_STORE_REMOTE`) for session auto-bootstrap. No CLI; session-scoped state only.
 * Verifies SHA chain and snapshot isolation via MCP tools only.
 */
import { assertEquals, assertExists } from "jsr:@std/assert";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";

import { TEST_SOURCE, toRemoteUrl } from "../helpers/config.ts";
import {
  createClient,
  insertPending,
  pinSet,
  reconcilePending,
  retrieve,
  stateInspect,
} from "../helpers/mcp-http-client.ts";
import { spawnMcpHttpIntegrationServer, waitForMcpHttpHealth } from "../helpers/mcp-subprocess.ts";
import { runGit } from "../helpers/run-git.ts";

const RUN_ID = `gle2e_${randomUUID().replace(/-/g, "")}`;
const SNAPSHOT_NAME = `snapshot_${RUN_ID}`;
const BRANCH_NAME = `mcp_workflow_${RUN_ID}_${randomUUID().replace(/-/g, "")}`;
const MARKER_A = `workflow_marker_a_${RUN_ID}`;
const MARKER_B = `workflow_marker_b_${RUN_ID}`;

function randomPort(): number {
  return 3500 + (randomBytes(2).readUInt16BE(0) % 1000);
}

Deno.test({
  name: "MCP session-driven workflow: pin_set, insert, reconcile, retrieve, snapshot isolation",
  // StreamableHTTP MCP SDK + nested deno subprocess: Deno leak sanitizer flags unconsumed fetch/SSE streams on close.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  // Two inserts produce content-hashed pending basenames and random markers; the reconcile request body is not
  // stable across runs, so replay-only VCR cannot use a committed tape. Use live OpenAI when a key is available
  // (spawn merges OPENAI_API_KEY from repo .env — see tests/helpers/mcp-subprocess.ts).
  Deno.env.set("GITERLOPER_OPENAI_VCR", "off");

  const port = randomPort();
  let server: ReturnType<typeof spawnMcpHttpIntegrationServer> | null = null;
  const projectRoot = mkdtempSync(path.join(tmpdir(), "giterloper-mcp-workflow-"));

  try {
    server = spawnMcpHttpIntegrationServer({ port, projectRoot });
    await waitForMcpHttpHealth(port);

    const client = await createClient({
      url: `http://127.0.0.1:${port}/mcp`,
      requestTimeoutMs: 600_000,
    });

    try {
      // 1. Get session SHA (session auto-bootstrapped at main via TEST_KNOWLEDGE_STORE_REMOTE in test mode)
      const inspectRes = await stateInspect(client);
      assertEquals(inspectRes.ok, true);
      assertExists(inspectRes.pins);
      const sessionPin = (inspectRes.pins as { name: string; sha: string }[]).find(
        (p) => p.name === "_session"
      );
      assertExists(sessionPin);
      const sessionSha = sessionPin.sha;

      // 2. Snapshot: create read-only pin at main
      const snapRes = await pinSet(client, {
        pin: SNAPSHOT_NAME,
        ref: "main",
      });
      assertEquals(snapRes.ok, true);

      // 3. Assign unique branch to session pin (omit pin → session)
      const branchRes = await pinSet(client, { branch: BRANCH_NAME });
      assertEquals(branchRes.ok, true);
      const branchSessionPin = (branchRes as { sessionPin?: { sha: string } }).sessionPin;
      assertExists(branchSessionPin);
      assertEquals(branchSessionPin.sha, sessionSha, "new branch same commit as session");

      // 4. Insert first knowledge entry (omit pin → session)
      const insert1 = await insertPending(client, {
        content: `# Topic A\n\n${MARKER_A}`,
      });
      assertEquals(insert1.ok, true);
      assertEquals(insert1.action, "inserted");
      assertExists(insert1.oldSha);
      assertExists(insert1.newSha);
      assertEquals(insert1.oldSha, sessionSha);
      assertEquals(insert1.oldSha !== insert1.newSha, true, "insert-1 advances sha");

      // 5. Insert second knowledge entry
      const insert2 = await insertPending(client, {
        content: `# Topic B\n\n${MARKER_B}`,
      });
      assertEquals(insert2.ok, true);
      assertEquals(insert2.oldSha, insert1.newSha);
      assertEquals(insert2.oldSha !== insert2.newSha, true, "insert-2 advances sha");

      // 6. Reconcile (omit pin → session)
      const reconcileRes = await reconcilePending(client, {});
      assertEquals(reconcileRes.ok, true);
      assertEquals(reconcileRes.action, "reconciled");
      assertEquals(reconcileRes.oldSha, insert2.newSha);
      assertEquals(reconcileRes.oldSha !== reconcileRes.newSha, true, "reconcile advances sha");

      // 7. Retrieve reconciled content from session pin (omit pin)
      const touched = reconcileRes.touched;
      assertExists(touched, "reconcile touched paths");
      assertEquals(touched.length > 0, true, "at least one touched path");

      const readHead = await retrieve(client, { path: touched[0] });
      assertEquals(readHead.ok, true);
      assertEquals(readHead.effectiveSha, reconcileRes.newSha);

      let union = "";
      for (const p of touched) {
        const r = await retrieve(client, { path: p });
        if (r.ok) union += r.content;
      }
      assertEquals(union.includes(MARKER_A) && union.includes(MARKER_B), true, "markers appear in corpus");

      const topicPath = touched[0];

      // 8. Snapshot isolation: retrieve same path from snapshot pin
      let snapshotContent: string | null = null;
      try {
        const snapRead = await retrieve(client, { pin: SNAPSHOT_NAME, path: topicPath });
        snapshotContent = snapRead.ok ? snapRead.content : null;
      } catch {
        // file-not-found expected — snapshot is at main, no reconciled files
      }
      if (snapshotContent !== null) {
        assertEquals(
          snapshotContent.includes(MARKER_A),
          false,
          "snapshot must not contain post-insert markers"
        );
        assertEquals(
          snapshotContent.includes(MARKER_B),
          false,
          "snapshot must not contain post-insert markers"
        );
      }
    } finally {
      await client.close();
    }
  } finally {
    server?.kill();
    try {
      runGit(["push", toRemoteUrl(TEST_SOURCE), "--delete", BRANCH_NAME]);
    } catch {
      /* branch may not exist */
    }
    try {
      rmSync(projectRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
},
});
