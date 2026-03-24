/**
 * Pin-law coverage for giterloper_pin_set via MCP HTTP (pin-semantics slice; tests/README pairing).
 * Transport/session wiring and tools/list schema stay in tests/mcp/.
 */
import { assertEquals } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";
import { resolveShaOrRef } from "../../lib/git.ts";
import { TEST_SOURCE } from "../helpers/config.ts";
import {
  mcpUnique,
  parseToolResult,
  reqTool,
  setupSession,
} from "../helpers/mcp-http-tool-session.ts";
import { withIsolatedGiterloperProjectRoot } from "../helpers/mcp-project-root-isolation.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const PIN_LAW_HINT = "pin-semantics slice — tests/README pairing";

/** pin_set with pin _session is rejected; omit pin to target session pin. */
Deno.test("pin_set with pin _session is rejected", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const res = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: { pin: "_session", branch: "main" } },
    });
    assertEquals(res.status, 200);
    const result = (await parseToolResult(res)) as {
      ok?: boolean;
      code?: string;
      message?: string;
    };
    assertEquals(result.ok, false, "pin_set with pin _session must fail");
    assertEquals(result.code, "invalid_argument");
    assertEquals(
      (result.message ?? "").includes("reserved") || (result.message ?? "").includes("omit"),
      true
    );
  });
});

/**
 * View-only: omit pin + no branch/ref returns session pin. Named pin + no branch/ref → FAIL
 * (pin-semantics slice — branch and ref matrix, case 4 / view-only).
 */
Deno.test("pin_set with no branch and no ref fails for named pin only", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const result1 = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: {} },
    })) as {
      ok?: boolean;
      sessionPin?: { name: string; source: string; sha: string; branch: string | null };
    };
    assertEquals(result1.ok, true, "pin_set with no modifiers views session pin");
    assertEquals(result1.sessionPin?.name, "_session");

    const res2 = await req({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: { pin: mcpUnique("noop") } },
    });
    assertEquals(res2.status, 200);
    const result2 = (await parseToolResult(res2)) as { ok?: boolean; code?: string };
    assertEquals(result2.ok, false, "pin_set with pin but no branch/ref must fail");
    assertEquals(result2.code, "invalid_argument");
  });
});

/** Pin storage: session pin's stored name is always _session (pin-semantics slice — Pin storage). */
Deno.test("session pin name is _session after bootstrap", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string }>;
    };
    assertEquals((inspectResult.pins?.length ?? 0) >= 1, true);
    const sessionRow = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(
      sessionRow !== undefined,
      true,
      `Session pin must be named _session (${PIN_LAW_HINT})`
    );
  });
});

/**
 * Branch specified, ref not: use session pin SHA (pin-semantics slice — matrix §1).
 */
Deno.test("pin_set branch-only (no pin) updates session pin branch, keeps SHA", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      ok?: boolean;
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    assertEquals(inspectResult.ok, true);
    assertEquals((inspectResult.pins?.length ?? 0) >= 1, true, "Need at least one pin");
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true, "Need _session pin");
    const originalSha = sessionPin!.sha;

    const branchName = mcpUnique("pin_set_branch_only");
    const setResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: { branch: branchName } },
    })) as {
      ok?: boolean;
      action?: string;
      sessionPin?: { name: string; source: string; sha: string; branch: string | null };
      message?: string;
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.action, "pin_set");
    assertEquals(setResult.sessionPin?.name, "_session");
    assertEquals(setResult.sessionPin?.branch, branchName);
    assertEquals(setResult.sessionPin?.sha, originalSha, "SHA must remain unchanged");

    const inspect2 = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const updated = inspect2.pins?.find((p) => p.name === "_session");
    assertEquals(updated?.branch, branchName);
    assertEquals(updated?.sha, originalSha);
  });
});

/**
 * Branch + named pin: copy session SHA (pin-semantics slice — matrix §1 + Pin name).
 */
Deno.test("pin_set branch+pin creates named pin at session SHA, session pin unchanged", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const sessionSha = sessionPin!.sha;
    const sessionBranch = sessionPin!.branch;

    const u = randomBytes(8).toString("hex");
    const snapshotName = `snapshot_test_${u}`;
    const snapshotBranch = `snapshot_branch_${u}`;

    const setResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: snapshotName, branch: snapshotBranch },
      },
    })) as {
      ok?: boolean;
      created?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.pin?.name, snapshotName);
    assertEquals(setResult.pin?.branch, snapshotBranch);
    assertEquals(setResult.created, true);

    const inspect2 = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const sessionAfter = inspect2.pins?.find((p) => p.name === "_session");
    const snapshotPin = inspect2.pins?.find((p) => p.name === snapshotName);
    assertEquals(sessionAfter !== undefined, true);
    assertEquals(snapshotPin !== undefined, true);
    assertEquals(
      snapshotPin!.sha,
      sessionAfter!.sha,
      "Named pin must inherit session pin SHA (single inspect after pin_set)"
    );
    assertEquals(setResult.pin?.sha, snapshotPin!.sha, "Tool output matches pinned.yaml");
    assertEquals(sessionAfter?.sha, sessionSha, "Session pin SHA unchanged");
    assertEquals(sessionAfter?.branch, sessionBranch, "Session pin branch unchanged");
    assertEquals(snapshotPin?.branch, snapshotBranch);
  });
});

/** ref specified, branch not: branchless read-only pin (pin-semantics slice — matrix §2). */
Deno.test("pin_set ref-only sets pin branchlessly", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; source: string; sha: string }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const sha = sessionPin!.sha;
    const branchlessName = mcpUnique("branchless");

    const setResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: branchlessName, ref: sha },
      },
    })) as {
      ok?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.pin?.name, branchlessName);
    assertEquals(setResult.pin?.sha, sha);
    assertEquals(setResult.pin?.branch, null, "Must be branchless (read-only)");

    const inspect2 = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const branchlessPin = inspect2.pins?.find((p) => p.name === branchlessName);
    assertEquals(branchlessPin?.sha, sha);
    assertEquals(branchlessPin?.branch, null);
  });
});

/** ref may be a non-SHA ref; resolve to SHA from remote (pin-semantics slice — Pin storage / matrix §2). */
Deno.test("pin_set ref as branch name resolves to SHA", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; source: string; sha: string }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const branchlessName = mcpUnique("ref_main");

    const setResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: branchlessName, ref: "main" },
      },
    })) as {
      ok?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.pin?.name, branchlessName);
    assertEquals(setResult.pin?.branch, null);
    const mainSha = await resolveShaOrRef(sessionPin!.source, "main");
    assertEquals(
      setResult.pin?.sha,
      mainSha,
      "ref=main must resolve to main's HEAD SHA from remote"
    );

    const inspect2 = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const pin = inspect2.pins?.find((p) => p.name === branchlessName);
    assertEquals(pin?.sha, mainSha);
    assertEquals(pin?.branch, null);
  });
});

/** Both ref and branch: use resolved ref SHA (pin-semantics slice — matrix §3). */
Deno.test("pin_set ref+branch+pin uses ref SHA not session SHA", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; source: string; sha: string }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const u = randomBytes(8).toString("hex");
    const snapshotName = `ref_branch_pin_${u}`;
    const snapshotBranch = `ref_branch_${u}`;

    const setResult = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: snapshotName, ref: "main", branch: snapshotBranch },
      },
    })) as {
      ok?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    const mainSha = await resolveShaOrRef(sessionPin!.source, "main");
    assertEquals(
      setResult.pin?.sha,
      mainSha,
      "ref=main must resolve to main HEAD SHA, not session SHA"
    );
    assertEquals(setResult.pin?.branch, snapshotBranch);

    const inspect2 = (await reqTool(req, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    })) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const pin = inspect2.pins?.find((p) => p.name === snapshotName);
    assertEquals(pin?.sha, mainSha);
    assertEquals(pin?.branch, snapshotBranch);
  });
});
