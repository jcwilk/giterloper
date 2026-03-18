/**
 * Minimal external MCP client for giterloper.
 * Exercises read, intake, reconcile over MCP HTTP/SSE only.
 * No imports from giterloper lib/ — truly external consumer.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface ClientConfig {
  /** Base URL for MCP endpoint (e.g. http://127.0.0.1:3443/mcp) */
  url: string;
  /** Bearer token for auth; omit when MCP_INSECURE=true on server */
  token?: string;
  /** Per-request timeout in ms. Defaults to MCP SDK default (60s). Use higher values for E2E tests with clone/push. */
  requestTimeoutMs?: number;
}

/** Parse tool result JSON from MCP callTool text content */
export function parseToolResult(text: string): unknown {
  return JSON.parse(text) as unknown;
}

interface TextContent {
  type: "text";
  text: string;
}

function getFirstTextContent(content: Array<{ type: string; text?: string }> | undefined): TextContent | null {
  const first = content?.[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") return null;
  return first as TextContent;
}

/** Create and connect an MCP client to giterloper. */
export async function createClient(config: ClientConfig): Promise<Client> {
  const url = new URL(config.url);
  const requestInit: RequestInit = {};
  if (config.token) {
    requestInit.headers = {
      Authorization: `Bearer ${config.token}`,
    };
  }
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit,
  });
  const client = new Client(
    { name: "reference_client", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);
  if (config.requestTimeoutMs != null) {
    (client as Client & { _giterloperRequestTimeoutMs?: number })._giterloperRequestTimeoutMs =
      config.requestTimeoutMs;
  }
  return client;
}

function getRequestOpts(client: Client): { timeout?: number } | undefined {
  const ms = (client as Client & { _giterloperRequestTimeoutMs?: number })._giterloperRequestTimeoutMs;
  return ms != null ? { timeout: ms } : undefined;
}

/** Call giterloper_search and return parsed result. */
export async function search(
  client: Client,
  args: { pin: string; query: string; sha?: string; limit?: number }
): Promise<{ ok: boolean; pin: string; effectiveSha: string; results: unknown[] }> {
  const result = await client.callTool(
    { name: "giterloper_search", arguments: args as Record<string, unknown> },
    undefined,
    getRequestOpts(client)
  );
  const content = getFirstTextContent(result.content as Array<{ type: string; text?: string }> | undefined);
  if (!content) {
    throw new Error("Unexpected tool response");
  }
  if (result.isError) {
    const err = parseToolResult(content.text) as { ok: false; code: string; message: string };
    throw new Error(`${err.code}: ${err.message}`);
  }
  return parseToolResult(content.text) as {
    ok: boolean;
    pin: string;
    effectiveSha: string;
    results: unknown[];
  };
}

/** Call giterloper_retrieve and return parsed result. Omit pin to use session pin. */
export async function retrieve(
  client: Client,
  args: { pin?: string; path: string; sha?: string }
): Promise<{ ok: boolean; pin: string; effectiveSha: string; path: string; content: string }> {
  const toolArgs: Record<string, unknown> = { path: args.path };
  if (args.pin != null && args.pin !== "") toolArgs.pin = args.pin;
  if (args.sha != null && args.sha !== "") toolArgs.sha = args.sha;
  const result = await client.callTool(
    { name: "giterloper_retrieve", arguments: toolArgs },
    undefined,
    getRequestOpts(client)
  );
  const content = getFirstTextContent(result.content as Array<{ type: string; text?: string }> | undefined);
  if (!content) {
    throw new Error("Unexpected tool response");
  }
  if (result.isError) {
    const err = parseToolResult(content.text) as { ok: false; code: string; message: string };
    throw new Error(`${err.code}: ${err.message}`);
  }
  return parseToolResult(content.text) as {
    ok: boolean;
    pin: string;
    effectiveSha: string;
    path: string;
    content: string;
  };
}

/** Call giterloper_state_inspect and return parsed result. */
export async function stateInspect(
  client: Client,
  args?: { pin?: string; verify?: boolean }
): Promise<{ ok: boolean; pins?: unknown[]; checks?: unknown[] }> {
  const result = await client.callTool(
    { name: "giterloper_state_inspect", arguments: (args ?? {}) as Record<string, unknown> },
    undefined,
    getRequestOpts(client)
  );
  const content = getFirstTextContent(result.content as Array<{ type: string; text?: string }> | undefined);
  if (!content) {
    throw new Error("Unexpected tool response");
  }
  if (result.isError) {
    const err = parseToolResult(content.text) as { ok: false; code: string; message: string };
    throw new Error(`${err.code}: ${err.message}`);
  }
  return parseToolResult(content.text) as {
    ok: boolean;
    pins?: unknown[];
    checks?: unknown[];
  };
}

/** Call giterloper_pin_set and return parsed result. */
export async function pinSet(
  client: Client,
  args: { pin?: string; source?: string; ref?: string; branch?: string }
): Promise<{ ok: boolean; action?: string; message?: string; pin?: { name: string }; sessionPin?: unknown }> {
  const result = await client.callTool(
    { name: "giterloper_pin_set", arguments: args as Record<string, unknown> },
    undefined,
    getRequestOpts(client)
  );
  const content = getFirstTextContent(result.content as Array<{ type: string; text?: string }> | undefined);
  if (!content) {
    throw new Error("Unexpected tool response");
  }
  if (result.isError) {
    const err = parseToolResult(content.text) as { ok: false; code: string; message: string };
    throw new Error(`${err.code}: ${err.message}`);
  }
  return parseToolResult(content.text) as {
    ok: boolean;
    action?: string;
    message?: string;
    pin?: { name: string };
    sessionPin?: unknown;
  };
}

/** Call giterloper_insert_pending and return parsed result. Omit pin to use session pin. */
export async function insertPending(
  client: Client,
  args: { pin?: string; content: string; name?: string }
): Promise<{
  ok: boolean;
  action: string;
  pin: string;
  branch: string;
  file: string;
  oldSha: string;
  newSha: string;
}> {
  const toolArgs: Record<string, unknown> = { content: args.content };
  if (args.pin != null && args.pin !== "") toolArgs.pin = args.pin;
  if (args.name != null && args.name !== "") toolArgs.name = args.name;
  const result = await client.callTool(
    { name: "giterloper_insert_pending", arguments: toolArgs },
    undefined,
    getRequestOpts(client)
  );
  const content = getFirstTextContent(result.content as Array<{ type: string; text?: string }> | undefined);
  if (!content) {
    throw new Error("Unexpected tool response");
  }
  if (result.isError) {
    const err = parseToolResult(content.text) as { ok: false; code: string; message: string };
    throw new Error(`${err.code}: ${err.message}`);
  }
  return parseToolResult(content.text) as {
    ok: boolean;
    action: string;
    pin: string;
    branch: string;
    file: string;
    oldSha: string;
    newSha: string;
  };
}

/** Call giterloper_reconcile_pending and return parsed result. Omit pin to use session pin. */
export async function reconcilePending(
  client: Client,
  args: { pin?: string } = {}
): Promise<{
  ok: boolean;
  action: string;
  pin: string;
  branch: string;
  oldSha: string;
  newSha: string;
  touched: string[];
  deleted: string[];
  unresolved: string[];
}> {
  const toolArgs: Record<string, unknown> = {};
  if (args.pin != null && args.pin !== "") toolArgs.pin = args.pin;
  const result = await client.callTool(
    { name: "giterloper_reconcile_pending", arguments: toolArgs },
    undefined,
    getRequestOpts(client)
  );
  const content = getFirstTextContent(result.content as Array<{ type: string; text?: string }> | undefined);
  if (!content) {
    throw new Error("Unexpected tool response");
  }
  if (result.isError) {
    const err = parseToolResult(content.text) as { ok: false; code: string; message: string };
    throw new Error(`${err.code}: ${err.message}`);
  }
  return parseToolResult(content.text) as {
    ok: boolean;
    action: string;
    pin: string;
    branch: string;
    oldSha: string;
    newSha: string;
    touched: string[];
    deleted: string[];
    unresolved: string[];
  };
}

/** Call giterloper_merge and return parsed result. */
export async function merge(
  client: Client,
  args: { sourcePin: string; targetPin: string }
): Promise<{
  ok: boolean;
  action: string;
  source: { pin: string; branch: string; sha: string };
  target: { pin: string; branch: string; oldSha: string; newSha: string };
}> {
  const result = await client.callTool(
    { name: "giterloper_merge", arguments: args as Record<string, unknown> },
    undefined,
    getRequestOpts(client)
  );
  const content = getFirstTextContent(result.content as Array<{ type: string; text?: string }> | undefined);
  if (!content) {
    throw new Error("Unexpected tool response");
  }
  if (result.isError) {
    const err = parseToolResult(content.text) as { ok: false; code: string; message: string };
    throw new Error(`${err.code}: ${err.message}`);
  }
  return parseToolResult(content.text) as {
    ok: boolean;
    action: string;
    source: { pin: string; branch: string; sha: string };
    target: { pin: string; branch: string; oldSha: string; newSha: string };
  };
}
