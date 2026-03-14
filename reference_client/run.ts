#!/usr/bin/env -S deno run -A
/**
 * Minimal demo: connect to giterloper MCP server and run read operations.
 * Usage: deno run -A run.ts [baseUrl]
 * Default: http://127.0.0.1:3443/mcp
 * Set MCP_INSECURE=true on server or pass token via MCP_TOKEN env.
 */
import {
  createClient,
  stateInspect,
  search,
  retrieve,
} from "./client.ts";

const baseUrl = Deno.args[0] ?? "http://127.0.0.1:3443/mcp";
const token = Deno.env.get("MCP_TOKEN");

const client = await createClient({ url: baseUrl, token: token ?? undefined });
try {
  const state = await stateInspect(client);
  console.log("Pins:", JSON.stringify(state.pins ?? [], null, 2));
  if (state.pins && state.pins.length > 0) {
    const first = state.pins[0] as { name?: string };
    const name = first?.name ?? "";
    if (name) {
      try {
        const searchResult = await search(client, { pin: name, query: "knowledge", limit: 3 });
        console.log("Search:", JSON.stringify(searchResult, null, 2));
        if (searchResult.results.length > 0) {
          const path = (searchResult.results[0] as { path?: string }).path;
          if (path) {
            const ret = await retrieve(client, { pin: name, path });
            console.log("Retrieve snippet:", ret.content.slice(0, 200) + "...");
          }
        }
      } catch (e) {
        console.warn("Search skipped (memsearch may not be installed):", (e as Error).message);
      }
    }
  }
} finally {
  await client.close();
}
