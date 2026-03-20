import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { E2E_MARKER } from "./config.ts";

/**
 * Per logical test case (or per test file until cases are split): isolated cwd, session id, and
 * collision token for remote resources. State lives at `<cwd>/.giterloper/<sessionId>/` (see
 * tests/README.md).
 */
export type TestRuntimeContext = {
  cwd: string;
  sessionId: string;
  /** Includes `E2E_MARKER`; use in pin/branch/file names. */
  runId: string;
};

/** Random CLI session id (valid for `validateSessionId`). */
export function newTestCliSessionId(): string {
  return `e2e_${randomBytes(16).toString("hex")}`;
}

/**
 * Creates a temp working directory and unique session/run ids. Register teardown with
 * `addEventListener("unload", () => destroyTestRuntimeContext(ctx))` or call
 * `destroyTestRuntimeContext` when the case finishes.
 */
export function createTestRuntimeContext(options?: { tmpPrefix?: string }): TestRuntimeContext {
  const prefix = options?.tmpPrefix ?? "giterloper-test-";
  const cwd = mkdtempSync(path.join(tmpdir(), prefix));
  const sessionId = newTestCliSessionId();
  const runId = `${E2E_MARKER}${randomUUID().replace(/-/g, "")}`;
  return { cwd, sessionId, runId };
}

export function destroyTestRuntimeContext(ctx: TestRuntimeContext): void {
  try {
    rmSync(ctx.cwd, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** Scratch pin name: `prefix_runId_uuid` (parallel-safe; UUID suffix for aggressive suite concurrency). */
export function scratchPinName(ctx: TestRuntimeContext, prefix: string): string {
  return `${prefix}_${ctx.runId}_${randomUUID().replace(/-/g, "")}`;
}
