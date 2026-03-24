import { assertEquals } from "jsr:@std/assert";

/**
 * Minimal discoverable case so `tests/pin-semantics/` participates in the unified harness
 * and `deno task test:pin-semantics` is non-empty. Substantive pin-law tests may land here
 * under follow-up work (e.g. ticket git-ewer).
 */
Deno.test("pin-semantics slice is wired for discovery", () => {
  assertEquals(true, true);
});
