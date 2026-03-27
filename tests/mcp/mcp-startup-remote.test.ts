/**
 * MCP startup: mandatory knowledge remote per active mode (MCP slice; tests/README pairing).
 * Subprocess checks ensure HTTP (`gl-mcp-server.ts`) and stdio (`gl-mcp-server-stdio.ts`)
 * exit before listen when the effective env var is missing/invalid. Docker uses the same HTTP entrypoint (Dockerfile CMD).
 */
import { assert, assertEquals } from "jsr:@std/assert";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { mcpStartupState } from "../../lib/gl-mcp-server.ts";
import {
  KNOWLEDGE_STORE_REMOTE_ENV,
  TEST_KNOWLEDGE_STORE_REMOTE_ENV,
} from "../../lib/session-layout.ts";
import { toRemoteUrl, TEST_SOURCE } from "../helpers/config.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Max time for MCP entrypoint subprocess (must exit before listen, or we abort). */
const MCP_SPAWN_TIMEOUT_MS = 15_000;

/**
 * Env for spawning MCP entrypoints under `Deno.Command`.
 * Deno **merges** `env` with the parent process environment — omitting a key does **not** unset it.
 * We start from a full copy, set both knowledge remotes to `""` so they override inherited `.env`,
 * then apply overrides (`undefined` → clear that key to `""` for unset semantics).
 */
function childEnvForMcpSpawn(overrides: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = { ...Deno.env.toObject() };
  env[KNOWLEDGE_STORE_REMOTE_ENV] = "";
  env[TEST_KNOWLEDGE_STORE_REMOTE_ENV] = "";
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) env[k] = "";
    else env[k] = v;
  }
  return env;
}

async function runEntrypoint(
  scriptRelative: string,
  env: Record<string, string>,
  scriptArgs: string[] = []
): Promise<{ code: number; stderr: string }> {
  const script = join(ROOT, scriptRelative);
  const signal = AbortSignal.timeout(MCP_SPAWN_TIMEOUT_MS);
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", script, ...scriptArgs],
    cwd: ROOT,
    env,
    stdout: "null",
    stderr: "piped",
    signal,
  });
  const out = await cmd.output();
  return {
    code: out.code,
    stderr: new TextDecoder().decode(out.stderr),
  };
}

Deno.test("MCP HTTP: normal mode exits non-zero when KNOWLEDGE_STORE_REMOTE is unset", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: undefined,
    [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: undefined,
  }));
  assertEquals(code, 1);
  assert(stderr.includes(KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP HTTP: normal mode exits non-zero when KNOWLEDGE_STORE_REMOTE is empty", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: "   ",
  }));
  assertEquals(code, 1);
  assert(stderr.includes(KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP HTTP: normal mode exits non-zero when KNOWLEDGE_STORE_REMOTE is invalid", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: "not:::a:::remote",
  }));
  assertEquals(code, 1);
  assert(stderr.includes(KNOWLEDGE_STORE_REMOTE_ENV), stderr);
  assert(stderr.includes("not a usable Git remote"), stderr);
});

Deno.test("MCP HTTP: exits non-zero when memsearch is not on PATH (remote valid)", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: "https://github.com/o/r",
    PATH: "/usr/bin:/bin",
  }));
  assertEquals(code, 1);
  assert(stderr.includes("memsearch"), stderr);
});

Deno.test("MCP HTTP: test mode exits non-zero when TEST_KNOWLEDGE_STORE_REMOTE is unset", async () => {
  const { code, stderr } = await runEntrypoint(
    "lib/gl-mcp-server.ts",
    childEnvForMcpSpawn({
      [KNOWLEDGE_STORE_REMOTE_ENV]: toRemoteUrl(TEST_SOURCE),
      [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: undefined,
    }),
    ["--mcp-test-mode"]
  );
  assertEquals(code, 1);
  assert(stderr.includes(TEST_KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP HTTP: test mode exits non-zero when TEST_KNOWLEDGE_STORE_REMOTE is empty", async () => {
  const { code, stderr } = await runEntrypoint(
    "lib/gl-mcp-server.ts",
    childEnvForMcpSpawn({
      [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: "  ",
    }),
    ["--mcp-test-mode"]
  );
  assertEquals(code, 1);
  assert(stderr.includes(TEST_KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP HTTP: test mode exits non-zero when TEST_KNOWLEDGE_STORE_REMOTE is invalid", async () => {
  const { code, stderr } = await runEntrypoint(
    "lib/gl-mcp-server.ts",
    childEnvForMcpSpawn({
      [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: "@@@",
    }),
    ["--mcp-test-mode"]
  );
  assertEquals(code, 1);
  assert(stderr.includes(TEST_KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP stdio: test mode exits non-zero when TEST_KNOWLEDGE_STORE_REMOTE is unset", async () => {
  const { code, stderr } = await runEntrypoint(
    "lib/gl-mcp-server-stdio.ts",
    childEnvForMcpSpawn({
      [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: undefined,
    }),
    ["--mcp-test-mode"]
  );
  assertEquals(code, 1);
  assert(stderr.includes(TEST_KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP stdio: test mode exits non-zero when TEST_KNOWLEDGE_STORE_REMOTE is empty", async () => {
  const { code, stderr } = await runEntrypoint(
    "lib/gl-mcp-server-stdio.ts",
    childEnvForMcpSpawn({
      [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: "",
    }),
    ["--mcp-test-mode"]
  );
  assertEquals(code, 1);
  assert(stderr.includes(TEST_KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP stdio: test mode exits non-zero when TEST_KNOWLEDGE_STORE_REMOTE is invalid", async () => {
  const { code, stderr } = await runEntrypoint(
    "lib/gl-mcp-server-stdio.ts",
    childEnvForMcpSpawn({
      [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: "not:::valid",
    }),
    ["--mcp-test-mode"]
  );
  assertEquals(code, 1);
  assert(stderr.includes(TEST_KNOWLEDGE_STORE_REMOTE_ENV), stderr);
  assert(stderr.includes("not a usable Git remote"), stderr);
});

Deno.test("MCP stdio: normal mode exits non-zero when KNOWLEDGE_STORE_REMOTE is unset", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server-stdio.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: undefined,
    [TEST_KNOWLEDGE_STORE_REMOTE_ENV]: undefined,
  }));
  assertEquals(code, 1);
  assert(stderr.includes(KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP stdio: normal mode exits non-zero when KNOWLEDGE_STORE_REMOTE is empty", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server-stdio.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: "\t",
  }));
  assertEquals(code, 1);
  assert(stderr.includes(KNOWLEDGE_STORE_REMOTE_ENV), stderr);
});

Deno.test("MCP stdio: normal mode exits non-zero when KNOWLEDGE_STORE_REMOTE is invalid", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server-stdio.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: "@@@",
  }));
  assertEquals(code, 1);
  assert(stderr.includes(KNOWLEDGE_STORE_REMOTE_ENV), stderr);
  assert(stderr.includes("not a usable Git remote"), stderr);
});

Deno.test("MCP stdio: exits non-zero when memsearch is not on PATH (remote valid)", async () => {
  const { code, stderr } = await runEntrypoint("lib/gl-mcp-server-stdio.ts", childEnvForMcpSpawn({
    [KNOWLEDGE_STORE_REMOTE_ENV]: "https://github.com/o/r",
    PATH: "/usr/bin:/bin",
  }));
  assertEquals(code, 1);
  assert(stderr.includes("memsearch"), stderr);
});

Deno.test("mcpStartupState succeeds in-process when effective remote is valid (shared createServer path)", () => {
  const normalEnv = {
    get: (key: string) => (key === KNOWLEDGE_STORE_REMOTE_ENV ? "https://github.com/o/r" : undefined),
  };
  const snap = mcpStartupState({ mcpTestMode: false, skipMemsearchVerification: true }, normalEnv);
  assertEquals(snap.mcpTestMode, false);
  assertEquals(snap.configuredKnowledgeStoreRemote, "https://github.com/o/r");

  const testEnv = {
    get: (key: string) =>
      key === TEST_KNOWLEDGE_STORE_REMOTE_ENV ? "https://github.com/t/k" : undefined,
  };
  const snapTest = mcpStartupState({ mcpTestMode: true, skipMemsearchVerification: true }, testEnv);
  assertEquals(snapTest.mcpTestMode, true);
  assertEquals(snapTest.configuredKnowledgeStoreRemote, "https://github.com/t/k");
});

Deno.test("mcpStartupState skips memsearch probe when skipMemsearchVerification", () => {
  const snap = mcpStartupState({
    mcpTestMode: false,
    knowledgeStoreRemote: "https://github.com/o/r",
    skipMemsearchVerification: true,
  });
  assertEquals(snap.mcpTestMode, false);
  assertEquals(snap.configuredKnowledgeStoreRemote, "https://github.com/o/r");
});

Deno.test("Dockerfile CMD runs HTTP MCP entrypoint (startup validation applies in container)", () => {
  const dockerfile = Deno.readTextFileSync(join(ROOT, "Dockerfile"));
  assert(
    dockerfile.includes("gl-mcp-server.ts"),
    "Dockerfile should invoke lib/gl-mcp-server.ts so KNOWLEDGE_STORE_REMOTE startup rules match native HTTP",
  );
  assert(
    dockerfile.includes('["deno", "run", "-A", "/app/lib/gl-mcp-server.ts"]'),
    "Dockerfile CMD should be deno run -A /app/lib/gl-mcp-server.ts",
  );
});
