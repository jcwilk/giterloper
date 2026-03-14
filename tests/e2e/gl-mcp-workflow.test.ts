/**
 * MCP E2E workflow tests: read → intake → reconcile → read loop.
 * Uses RUN_ID (gle2e_) for collision safety. Targets giterloper_test_knowledge only.
 * Asserts state-id (effectiveSha, oldSha, newSha) transitions.
 */
import { assertEquals, assertExists } from "jsr:@std/assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

import {
  CLEAN_MAIN_SHA,
  E2E_MARKER,
  TEST_MAIN_REF,
  TEST_SOURCE,
  toRemoteUrl,
} from "./config.ts";
import { cleanupTestKnowledgeRepo } from "../helpers/cleanup.ts";
import { runGlMaintenanceJson, runGlJson } from "../helpers/gl.ts";
import {
  createClient,
  insertPending,
  reconcilePending,
  retrieve,
} from "../../reference_client/client.ts";

const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;

function randomPin(prefix: string): string {
  return `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}`;
}

function pinByName(list: { name?: string; sha?: string }[] | unknown, name: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.find((p: { name?: string }) => p.name === name) as
    | { name?: string; sha?: string }
    | undefined;
}

function ensurePinRemoved(name: string): void {
  const pins = runGlJson(["pin", "list"]) as { name?: string }[];
  if (pinByName(pins, name)) runGlJson(["pin", "remove", name]);
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

function createRemoteBranchFromMain(
  branchName: string,
  contentPath: string,
  contentBody: string
): string {
  const tempRoot = Deno.makeTempDirSync({ prefix: "giterloper-mcp-e2e-" });
  const repoDir = path.join(tempRoot, "repo");
  try {
    runGit(["clone", "--quiet", toRemoteUrl(TEST_SOURCE), repoDir]);
    runGit(["checkout", TEST_MAIN_REF], { cwd: repoDir });
    runGit(["checkout", "-b", branchName], { cwd: repoDir });
    runGit(["config", "user.name", "giterloper-test"], { cwd: repoDir });
    runGit(["config", "user.email", "giterloper-test@example.com"], { cwd: repoDir });
    const fullPath = path.join(repoDir, contentPath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contentBody, "utf8");
    runGit(["add", path.relative(repoDir, fullPath)], { cwd: repoDir });
    runGit(["commit", "-m", `MCP E2E branch ${branchName}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branchName}`], { cwd: repoDir });
    return runGit(["rev-parse", "HEAD"], { cwd: repoDir });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function randomPort(): number {
  return 3500 + (randomBytes(2).readUInt16BE(0) % 1000);
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
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    kill: () => proc.kill("SIGTERM"),
  };
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

Deno.test("MCP read → intake → reconcile → read loop with state-id assertions", async () => {
  const pinName = randomPin("mcp-flow");
  const branch = `${pinName}-branch`;
  const initialPath = `knowledge/e2e_${RUN_ID}_${randomBytes(4).toString("hex")}.md`;
  const initialContent = "# Initial Topic\n\nmcp_workflow_initial_marker";
  const intakeContent = "# Intake Topic\n\nmcp_workflow_intake_marker";
  const port = randomPort();
  let server: ServerHandle | null = null;

  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch });
    createRemoteBranchFromMain(branch, initialPath, initialContent);
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
    const stagedPath = path.join(Deno.cwd(), ".giterloper", "staged", pinName, branch);
    if (!existsSync(stagedPath)) {
      throw new Error(`Stage failed: ${stagedPath} does not exist`);
    }
    runGlMaintenanceJson(["promote", "--pin", pinName]);
    runGlJson(["pin", "load", "--pin", pinName]);

    server = startMcpServer(port);
    await waitForServer(port);

    const client = await createClient({
      url: `http://127.0.0.1:${port}/mcp`,
    });

    try {
      // Read 1: retrieve initial file, capture effectiveSha (state-id)
      const read1 = await retrieve(client, { pin: pinName, path: initialPath });
      assertEquals(read1.ok, true);
      assertExists(read1.effectiveSha);
      assertEquals(read1.path, initialPath);
      assertEquals(read1.content.includes("mcp_workflow_initial_marker"), true);
      const shaBeforeIntake = read1.effectiveSha;

      // Intake: insert_pending
      const insertResult = await insertPending(client, {
        pin: pinName,
        content: intakeContent,
      });
      assertEquals(insertResult.ok, true);
      assertEquals(insertResult.action, "inserted");
      assertExists(insertResult.oldSha);
      assertExists(insertResult.newSha);
      assertEquals(insertResult.oldSha, shaBeforeIntake, "insert oldSha should match prior read effectiveSha");
      assertEquals(insertResult.oldSha !== insertResult.newSha, true, "insert should advance sha");

      // Reconcile: reconcile_pending
      const reconcileResult = await reconcilePending(client, { pin: pinName });
      assertEquals(reconcileResult.ok, true);
      assertEquals(reconcileResult.action, "reconciled");
      assertExists(reconcileResult.oldSha);
      assertExists(reconcileResult.newSha);
      assertEquals(reconcileResult.oldSha, insertResult.newSha, "reconcile oldSha should match insert newSha");
      assertEquals(reconcileResult.oldSha !== reconcileResult.newSha, true, "reconcile should advance sha");

      // Read 2: retrieve reconciled topic file
      const topicPath = "knowledge/intake-topic.md";
      const read2 = await retrieve(client, { pin: pinName, path: topicPath });
      assertEquals(read2.ok, true);
      assertExists(read2.effectiveSha);
      assertEquals(read2.effectiveSha, reconcileResult.newSha, "post-reconcile read effectiveSha should match reconcile newSha");
      assertEquals(read2.content.includes("mcp_workflow_intake_marker"), true);
    } finally {
      await client.close();
    }
  } finally {
    server?.kill();
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch });
  }
});
