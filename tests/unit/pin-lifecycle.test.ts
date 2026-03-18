/**
 * Unit tests for pin-lifecycle: updatePinSha, internal _session path.
 * Per docs/PIN_SETTING_PARAM_BEHAVIOR.md: validation applies at API input boundary.
 * Internal lifecycle (insert, reconcile, merge) may pass SESSION_PIN_NAME to updatePinSha.
 */
import { assertEquals } from "jsr:@std/assert";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import type { GlState } from "../../lib/types.ts";
import { SESSION_PIN_NAME } from "../../lib/pinned.ts";
import { updatePinSha } from "../../lib/pin-lifecycle.ts";
import { readPins } from "../../lib/pinned.ts";
import { CLEAN_MAIN_SHA, TEST_SOURCE } from "../e2e/config.ts";

function makeState(root: string): GlState {
  return {
    projectRoot: path.dirname(root),
    rootDir: root,
    versionsDir: path.join(root, "versions"),
    stagedRoot: path.join(root, "staged"),
    pinnedPath: path.join(root, "pinned.yaml"),
    globalJson: false,
    sessionId: `lifecycle-${Date.now()}`,
  };
}

/**
 * Internal lifecycle path: updatePinSha receives SESSION_PIN_NAME from insert/reconcile
 * when pin was omitted. Must not reject _session (validation is at API boundary only).
 * Uses real test repo for clone; requires network.
 */
Deno.test("updatePinSha accepts _session for internal lifecycle path", () => {
  const root = path.join(tmpdir(), `pin-lifecycle-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  const pinnedContent = `_session:
  repo: ${TEST_SOURCE}
  sha: ${CLEAN_MAIN_SHA}
  branch: main
`;
  writeFileSync(path.join(root, "pinned.yaml"), pinnedContent, "utf8");
  const state = makeState(root);
  try {
    updatePinSha(state, SESSION_PIN_NAME, CLEAN_MAIN_SHA, {});
    const pins = readPins(state);
    const session = pins.find((p) => p.name === SESSION_PIN_NAME);
    assertEquals(session !== undefined, true, "Session pin must exist after update");
    assertEquals(session!.sha, CLEAN_MAIN_SHA);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});
