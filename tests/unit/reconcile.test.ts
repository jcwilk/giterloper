import { assertEquals } from "jsr:@std/assert";
import { safeName, makeQueueFilename } from "../../lib/reconcile.ts";

Deno.test("safeName trims and replaces invalid chars with dashes", () => {
  assertEquals(safeName("  foo bar  "), "foo-bar");
});

Deno.test("safeName strips leading/trailing dashes", () => {
  assertEquals(safeName("---x---"), "x");
});

Deno.test("safeName returns entry for empty or whitespace", () => {
  assertEquals(safeName(""), "entry");
  assertEquals(safeName("   "), "entry");
  assertEquals(safeName(null), "entry");
  assertEquals(safeName(undefined), "entry");
});

Deno.test("safeName allows alphanumeric, dot, underscore, hyphen", () => {
  assertEquals(safeName("a-z_A.Z-0"), "a-z_A.Z-0");
});

Deno.test("makeQueueFilename uses nameArg when provided, appends .md if needed", () => {
  assertEquals(makeQueueFilename("", "my topic"), "my-topic.md");
  assertEquals(makeQueueFilename("", "already.md"), "already.md");
});

Deno.test("makeQueueFilename hashes content when nameArg is null/undefined", () => {
  const h1 = makeQueueFilename("hello", undefined);
  const h2 = makeQueueFilename("hello", null);
  assertEquals(h1.endsWith(".md"), true);
  assertEquals(h1.length >= 13 && h1.length <= 20, true);
  assertEquals(h1, h2);
});
