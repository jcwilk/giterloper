/**
 * Test helpers for reference_client E2E tests.
 * Uses relative ../ paths to giterloper workspace. Spawns processes only — no lib/ imports.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const _dirname = path.dirname(fileURLToPath(import.meta.url));
export const REF_CLIENT_DIR = _dirname;
export const WORKSPACE_ROOT = path.join(_dirname, "..");

const GL_SCRIPT = path.join(WORKSPACE_ROOT, ".cursor", "skills", "gl", "scripts", "gl");
const GL_MAINTENANCE = path.join(WORKSPACE_ROOT, "scripts", "gl-maintenance");

export const E2E_MARKER = "rc2e_";
export const TEST_SOURCE = "github.com/jcwilk/giterloper_test_knowledge";
export const CLEAN_MAIN_SHA = "8ff8196117fd5b5ad70a16f1c40df8ed1c760179";
export const TEST_MAIN_REF = "main";

export function toRemoteUrl(source: string): string {
  const token = Deno.env.get("GITERLOPER_GH_TOKEN");
  if (token && source.includes("github.com")) {
    return `https://x-access-token:${token}@${source}`;
  }
  return `https://${source}`;
}

export function randomPin(prefix: string): string {
  return `${prefix}_${E2E_MARKER}${randomBytes(8).toString("hex")}`;
}

function runGit(args: string[], opts: { cwd?: string; silent?: boolean } = {}): string {
  const result = spawnSync("git", args, {
    cwd: opts.cwd ?? WORKSPACE_ROOT,
    encoding: "utf8",
    stdio: ["ignore", opts.silent ? "ignore" : "pipe", "pipe"],
  });
  if (result.error) throw new Error(`Failed to run git: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "git failed").trim();
    throw new Error(stderr);
  }
  return (result.stdout || "").trim();
}

function runGlJson(args: string[]): unknown {
  const result = spawnSync(GL_SCRIPT, ["--json", ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error(`Failed to run gl: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "gl failed").trim();
    throw new Error(stderr);
  }
  return JSON.parse((result.stdout || "null").trim() || "null");
}

function runGlMaintenanceJson(args: string[]): unknown {
  const result = spawnSync(GL_MAINTENANCE, ["--json", ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error(`Failed to run gl-maintenance: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "gl-maintenance failed").trim();
    throw new Error(stderr);
  }
  return JSON.parse((result.stdout || "null").trim() || "null");
}

function getPin(list: unknown, name: string): { name?: string; sha?: string } | undefined {
  const arr = Array.isArray(list) ? list : [];
  return (arr as { name?: string }[]).find((p) => p.name === name) as
    | { name?: string; sha?: string }
    | undefined;
}

export function ensurePinRemoved(name: string): void {
  const pins = runGlJson(["pin", "list"]) as { name?: string }[];
  if (getPin(pins, name)) runGlJson(["pin", "remove", name]);
}

function cleanupLocalCopies(pinName: string): void {
  const versionsDir = path.join(WORKSPACE_ROOT, ".giterloper", "versions", pinName);
  const stagedDir = path.join(WORKSPACE_ROOT, ".giterloper", "staged", pinName);
  try {
    rmSync(versionsDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    rmSync(stagedDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function cleanupTestRepo(opts: { pinName: string; branchName?: string }): void {
  cleanupLocalCopies(opts.pinName);
  const url = toRemoteUrl(TEST_SOURCE);
  const remoteHeads = runGit(["ls-remote", "--heads", url]);
  const branches = remoteHeads
    .split("\n")
    .map((l) => l.trim().split(/\s+/)[1]?.replace("refs/heads/", ""))
    .filter(Boolean) as string[];
  if (opts.branchName && branches.includes(opts.branchName)) {
    runGit(["push", url, "--delete", opts.branchName]);
  }
  const tempRoot = path.join(tmpdir(), `giterloper-rc2e-${randomBytes(4).toString("hex")}`);
  try {
    runGit(["clone", "--quiet", url, path.join(tempRoot, "repo")]);
    const repoDir = path.join(tempRoot, "repo");
    runGit(["checkout", CLEAN_MAIN_SHA], { cwd: repoDir });
    runGit(["push", "--force", "origin", `${CLEAN_MAIN_SHA}:refs/heads/main`], { cwd: repoDir });
    if (opts.branchName) {
      runGit(["checkout", "-b", opts.branchName], { cwd: repoDir });
      runGit(["push", "--force", "origin", `HEAD:refs/heads/${opts.branchName}`], {
        cwd: repoDir,
      });
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  cleanupLocalCopies(opts.pinName);
}

export function createRemoteBranch(
  branchName: string,
  contentPath: string,
  contentBody: string
): string {
  const tempRoot = path.join(tmpdir(), `giterloper-branch-${randomBytes(4).toString("hex")}`);
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
    runGit(["commit", "-m", `Test branch ${branchName}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branchName}`], { cwd: repoDir });
    return runGit(["rev-parse", "HEAD"], { cwd: repoDir });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function addTestPin(
  pinName: string,
  branch: string,
  initialContentPath: string,
  initialContent: string
): void {
  runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
  runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
  const stagedPath = path.join(WORKSPACE_ROOT, ".giterloper", "staged", pinName, branch);
  if (!existsSync(stagedPath)) {
    throw new Error(`Stage failed: ${stagedPath} does not exist`);
  }
  const filePath = path.join(stagedPath, initialContentPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, initialContent, "utf8");
  runGlMaintenanceJson(["promote", "--pin", pinName]);
  runGlJson(["pin", "load", "--pin", pinName]);
}

export interface ServerHandle {
  port: number;
  process: ReturnType<typeof spawn>;
  kill: () => void;
}

/** Start giterloper MCP server on a given port. Uses relative path to lib/gl-mcp-server.ts. */
export function startServer(port: number): ServerHandle {
  const proc = spawn(
    "deno",
    ["run", "-A", path.join(WORKSPACE_ROOT, "lib", "gl-mcp-server.ts")],
    {
      cwd: WORKSPACE_ROOT,
      env: {
        ...Deno.env.toObject(),
        MCP_PORT: String(port),
        MCP_INSECURE: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const kill = () => {
    proc.kill("SIGTERM");
  };
  return { port, process: proc, kill };
}

/** Check if memsearch binary is available (required for search tool). */
export function hasMemsearch(): boolean {
  const result = spawnSync("which", ["memsearch"], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && (result.stdout?.trim() ?? "").length > 0;
}

/** Wait for server to be ready (health endpoint). */
export async function waitForServer(port: number, timeoutMs = 5000): Promise<void> {
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
