/**
 * Stdio transport smoke test: initialize + tools/list over stdio with process-scoped session.
 * Parity with HTTP is covered by mcp-session-lifecycle.test.ts; this proves stdio wiring and
 * getSessionId injection. See ticket git-vraz, docs/STDIO_TRANSPORT_SPIKE.md.
 */
import { assertEquals } from "jsr:@std/assert";
import { once } from "node:events";
import { createInterface } from "node:readline";

import { spawnMcpStdioIntegrationServer } from "../helpers/mcp-subprocess.ts";

Deno.test("MCP stdio: initialize and tools/list succeed with process-scoped session", async () => {
  const { proc, kill } = spawnMcpStdioIntegrationServer();
  const stdin = proc.stdin!;
  const stdout = proc.stdout!;

  const rl = createInterface({ input: stdout, crlfDelay: Infinity });
  const readJsonLine = () =>
    new Promise<string>((resolve, reject) => {
      const onLine = (line: string) => {
        rl.off("close", onClose);
        resolve(line);
      };
      const onClose = () => {
        rl.off("line", onLine);
        reject(new Error("stdout closed before line"));
      };
      rl.once("line", onLine);
      rl.once("close", onClose);
    });

  try {
    const initReq = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "stdio-smoke", version: "1.0.0" },
      },
    }) + "\n";
    stdin.write(initReq, "utf8");
    const initLine = await readJsonLine();
    const initRes = JSON.parse(initLine) as { result?: unknown; error?: { message?: string } };
    assertEquals(initRes.error, undefined, `initialize should not error: ${initRes.error?.message ?? initLine}`);
    assertEquals(!!initRes.result, true, "initialize should return result");

    const listReq = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }) + "\n";
    stdin.write(listReq, "utf8");
    const listLine = await readJsonLine();
    const listRes = JSON.parse(listLine) as { result?: { tools?: unknown[] }; error?: { message?: string } };
    assertEquals(listRes.error, undefined, `tools/list should not error: ${listRes.error?.message ?? listLine}`);
    assertEquals(Array.isArray(listRes.result?.tools), true, "tools/list should return tools array");
  } finally {
    rl.close();
    stdin.end();
    stdout.destroy();
    kill();
    await once(proc, "exit");
  }
});
