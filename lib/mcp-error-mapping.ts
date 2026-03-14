/**
 * Maps giterloper errors to MCP API contract error codes.
 * See docs/MCP_API_CONTRACT.md §5 Error envelope.
 */
import { EXIT, GlError, StaleIndexError } from "./errors.ts";

export type McpErrorCode =
  | "missing_pin"
  | "stale_index"
  | "mismatched_sha"
  | "branchless_write"
  | "reconciliation_conflict"
  | "invalid_argument"
  | "external";

export interface McpErrorResult {
  ok: false;
  code: McpErrorCode;
  message: string;
  details: Record<string, unknown>;
}

const PIN_NOT_FOUND = /pin "([^"]+)" not found/i;
const NO_PINS = /no pins configured/i;
const HAS_NO_BRANCH = /has no branch|branchless/i;
const STALE = /stale|pin SHA does not match remote/i;
const MERGE_CONFLICT = /merge conflict|cannot be merged automatically/i;
const INDEX_MISMATCH = /index metadata|stale.?index/i;

/**
 * Maps a thrown error to an MCP error envelope.
 * Defaults to `external` for unknown errors.
 */
export function mapErrorToMcp(error: unknown): McpErrorResult {
  const msg = error instanceof Error ? error.message : String(error);

  if (error instanceof StaleIndexError) {
    return {
      ok: false,
      code: "stale_index",
      message: error.message,
      details: {
        expectedPinName: error.expectedPinName,
        expectedSha: error.expectedSha,
      },
    };
  }

  if (error instanceof GlError) {
    if (PIN_NOT_FOUND.test(msg) || NO_PINS.test(msg)) {
      return { ok: false, code: "missing_pin", message: msg, details: {} };
    }
    if (INDEX_MISMATCH.test(msg)) {
      return { ok: false, code: "stale_index", message: msg, details: {} };
    }
    if (STALE.test(msg)) {
      return { ok: false, code: "mismatched_sha", message: msg, details: {} };
    }
    if (HAS_NO_BRANCH.test(msg)) {
      return { ok: false, code: "branchless_write", message: msg, details: {} };
    }
    if (MERGE_CONFLICT.test(msg)) {
      return {
        ok: false,
        code: "reconciliation_conflict",
        message: msg,
        details: {},
      };
    }
    // EXIT.USER (1), EXIT.STATE (2), EXIT.EXTERNAL (3) — treat as external for non-mapped
    return { ok: false, code: "external", message: msg, details: {} };
  }

  if (PIN_NOT_FOUND.test(msg) || NO_PINS.test(msg)) {
    return { ok: false, code: "missing_pin", message: msg, details: {} };
  }
  if (INDEX_MISMATCH.test(msg)) {
    return { ok: false, code: "stale_index", message: msg, details: {} };
  }
  if (STALE.test(msg)) {
    return { ok: false, code: "mismatched_sha", message: msg, details: {} };
  }
  if (HAS_NO_BRANCH.test(msg)) {
    return { ok: false, code: "branchless_write", message: msg, details: {} };
  }
  if (MERGE_CONFLICT.test(msg)) {
    return {
      ok: false,
      code: "reconciliation_conflict",
      message: msg,
      details: {},
    };
  }

  return {
    ok: false,
    code: "external",
    message: msg,
    details: {},
  };
}

/** HTTP status for each MCP error code per contract §5.1 */
export function mcpCodeToHttpStatus(code: McpErrorCode): number {
  switch (code) {
    case "missing_pin":
      return 404;
    case "stale_index":
    case "mismatched_sha":
    case "reconciliation_conflict":
      return 409;
    case "branchless_write":
    case "invalid_argument":
      return 400;
    case "external":
    default:
      return 500;
  }
}
