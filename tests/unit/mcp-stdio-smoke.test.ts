/**
 * Stdio transport smoke test: initialize + tools/list over stdio with process-scoped session.
 * Parity with HTTP is covered by mcp-session-lifecycle.test.ts; this proves stdio wiring and
 * getSessionId injection. See ticket git-vraz, docs/STDIO_TRANSPORT_SPIKE.md.
 */
import { assertEquals } from "jsr:@std/assert";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let buf = "";
  return (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return buf;
      buf += decoder.decode(value, { stream: true });
      const idx = buf.indexOf("\n");
      if (idx !== -1) {
        const line = buf.slice(0, idx);
        return line;
      }
    }
  })();
}

Deno.test("MCP stdio: initialize and tools/list succeed with process-scoped session", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", join(ROOT, "lib", "gl-mcp-server-stdio.ts")],
    cwd: ROOT,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const stdin = child.stdin.getWriter();
  const stdoutReader = child.stdout.getReader();

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
    await stdin.write(new TextEncoder().encode(initReq));
    const initLine = await readLine(stdoutReader);
    const initRes = JSON.parse(initLine) as { result?: unknown; error?: { message?: string } };
    assertEquals(initRes.error, undefined, `initialize should not error: ${initRes.error?.message ?? initLine}`);
    assertEquals(!!initRes.result, true, "initialize should return result");

    const listReq = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }) + "\n";
    await stdin.write(new TextEncoder().encode(listReq));
    const listLine = await readLine(stdoutReader);
    const listRes = JSON.parse(listLine) as { result?: { tools?: unknown[] }; error?: { message?: string } };
    assertEquals(listRes.error, undefined, `tools/list should not error: ${listRes.error?.message ?? listLine}`);
    assertEquals(Array.isArray(listRes.result?.tools), true, "tools/list should return tools array");
  } finally {
    stdin.close();
    stdoutReader.releaseLock();
    await child.stdout.cancel();
    await child.stderr.cancel();
    child.kill("SIGTERM");
    await child.status;
  }
});
