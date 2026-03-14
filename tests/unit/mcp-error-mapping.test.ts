import { assertEquals } from "jsr:@std/assert";
import { GlError, StaleIndexError } from "../../lib/errors.ts";
import { mapErrorToMcp, mcpCodeToHttpStatus } from "../../lib/mcp-error-mapping.ts";

Deno.test("mapErrorToMcp maps StaleIndexError to stale_index", () => {
  const err = new StaleIndexError(
    "index metadata mismatch",
    "pin1",
    "abc123",
    "pin2",
    "def456"
  );
  const result = mapErrorToMcp(err);
  assertEquals(result.ok, false);
  assertEquals(result.code, "stale_index");
  assertEquals(result.details.expectedPinName, "pin2");
  assertEquals(result.details.expectedSha, "def456");
});

Deno.test("mapErrorToMcp maps pin not found to missing_pin", () => {
  const err = new GlError('pin "foo" not found', 1);
  const result = mapErrorToMcp(err);
  assertEquals(result.ok, false);
  assertEquals(result.code, "missing_pin");
});

Deno.test("mapErrorToMcp maps no pins to missing_pin", () => {
  const err = new GlError("no pins configured in .giterloper/pinned.yaml", 2);
  const result = mapErrorToMcp(err);
  assertEquals(result.ok, false);
  assertEquals(result.code, "missing_pin");
});

Deno.test("mapErrorToMcp maps branchless to branchless_write", () => {
  const err = new GlError('pin "x" has no branch', 1);
  const result = mapErrorToMcp(err);
  assertEquals(result.ok, false);
  assertEquals(result.code, "branchless_write");
});

Deno.test("mapErrorToMcp maps merge conflict to reconciliation_conflict", () => {
  const err = new GlError("Merge conflict: branches cannot be merged automatically", 2);
  const result = mapErrorToMcp(err);
  assertEquals(result.ok, false);
  assertEquals(result.code, "reconciliation_conflict");
});

Deno.test("mcpCodeToHttpStatus returns correct status codes", () => {
  assertEquals(mcpCodeToHttpStatus("missing_pin"), 404);
  assertEquals(mcpCodeToHttpStatus("stale_index"), 409);
  assertEquals(mcpCodeToHttpStatus("mismatched_sha"), 409);
  assertEquals(mcpCodeToHttpStatus("branchless_write"), 400);
  assertEquals(mcpCodeToHttpStatus("reconciliation_conflict"), 409);
  assertEquals(mcpCodeToHttpStatus("external"), 500);
});
