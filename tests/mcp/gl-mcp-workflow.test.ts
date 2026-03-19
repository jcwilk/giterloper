/**
 * MCP integration workflow: session-driven, minimal setup (higher-level agent path).
 * Uses KNOWLEDGE_STORE_REMOTE for session auto-bootstrap. No CLI; session-scoped state only.
 * Verifies SHA chain and snapshot isolation via MCP tools only.
 */
import { assertEquals, assertExists } from "jsr:@std/assert";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

import { TEST_SOURCE, toRemoteUrl } from "../helpers/config.ts";
import {
  createClient,
  insertPending,
  pinSet,
  reconcilePending,
  retrieve,
  stateInspect,
} from "../../reference_client/client.ts";

const RUN_ID = `gle2e_${randomBytes(8).toString("hex")}`;
const SNAPSHOT_NAME = `snapshot_${RUN_ID}`;
const BRANCH_NAME = `mcp_workflow_${RUN_ID}_${randomBytes(4).toString("hex")}`;
const MARKER_A = `workflow_marker_a_${RUN_ID}`;
const MARKER_B = `workflow_marker_b_${RUN_ID}`;

function randomPort(): number {
  return 3500 + (randomBytes(2).readUInt16BE(0) % 1000);
}

function runGit(args: string[], opts: { cwd?: string } = {}): string {
  const result = spawnSync("git", args, {
    cwd: opts.cwd ?? Deno.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error(`Failed to run git: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "git failed").trim();
    throw new Error(stderr);
  }
  return (result.stdout || "").trim();
}

interface ServerHandle {
  kill: () => void;
}

function startMcpServer(port: number): ServerHandle {
  const proc = spawn("deno", ["run", "-A", path.join(Deno.cwd(), "lib", "gl-mcp-server.ts")], {
    cwd: Deno.cwd(),
    env: {
      ...Deno.env.toObject(),
      MCP_PORT: String(port),
      MCP_INSECURE: "true",
      KNOWLEDGE_STORE_REMOTE: TEST_SOURCE,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { kill: () => proc.kill("SIGTERM") };
}

async function waitForServer(port: number, timeoutMs = 8000): Promise<void> {
  const url = `http://127.0.0.1:${port}/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      await res.text();
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server not ready at ${url} within ${timeoutMs}ms`);
}

Deno.test("MCP session-driven workflow: pin_set, insert, reconcile, retrieve, snapshot isolation", async () => {
  const port = randomPort();
  let server: ServerHandle | null = null;

  try {
    server = startMcpServer(port);
    await waitForServer(port);

    const client = await createClient({
      url: `http://127.0.0.1:${port}/mcp`,
      requestTimeoutMs: 120000,
    });

    try {
      // 1. Get session SHA (session auto-bootstrapped at main via KNOWLEDGE_STORE_REMOTE)
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
      assertExists(reconcileRes.touched, "reconcile touched paths");
      const topicPath = reconcileRes.touched[0];
      assertExists(topicPath, "at least one touched path");

      const readRes = await retrieve(client, { path: topicPath });
      assertEquals(readRes.ok, true);
      assertEquals(readRes.effectiveSha, reconcileRes.newSha);
      assertEquals(
        readRes.content.includes(MARKER_A) || readRes.content.includes(MARKER_B),
        true,
        "content reflects inserts"
      );

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
    // Cleanup: delete test branch from remote
    try {
      runGit(["push", toRemoteUrl(TEST_SOURCE), "--delete", BRANCH_NAME]);
    } catch {
      /* branch may not exist */
    }
  }
});
