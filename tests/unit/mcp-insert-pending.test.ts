import { assertEquals } from "jsr:@std/assert";
import { validateInsertContent } from "../../lib/gl-mcp-server.ts";

Deno.test("validateInsertContent rejects empty string", () => {
  const result = validateInsertContent("");
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

Deno.test("validateInsertContent rejects whitespace-only", () => {
  const result = validateInsertContent("   \n\t  ");
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

Deno.test("validateInsertContent rejects null", () => {
  const result = validateInsertContent(null);
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

Deno.test("validateInsertContent rejects undefined", () => {
  const result = validateInsertContent(undefined);
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

Deno.test("validateInsertContent accepts non-empty content", () => {
  assertEquals(validateInsertContent("# Hello"), null);
  assertEquals(validateInsertContent("  # trimmed  "), null);
  assertEquals(validateInsertContent("x"), null);
});
