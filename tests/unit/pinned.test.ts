import { assertEquals, assertThrows } from "jsr:@std/assert";
import { parsePinned, serializePins } from "../../lib/pinned.ts";

Deno.test("parsePinned parses nested format", () => {
  const yaml = `foo:
  repo: github.com/x/repo
  sha: 0123456789abcdef0123456789abcdef01234567
  branch: main
`;
  const pins = parsePinned(yaml);
  assertEquals(pins.length, 1);
  assertEquals(pins[0].name, "foo");
  assertEquals(pins[0].source, "github.com/x/repo");
  assertEquals(pins[0].sha, "0123456789abcdef0123456789abcdef01234567");
  assertEquals(pins[0].branch, "main");
});

Deno.test("parsePinned parses legacy one-liner format", () => {
  const yaml = `bar: github.com/y/repo@abcdef0123456789abcdef0123456789abcdef01
`;
  const pins = parsePinned(yaml);
  assertEquals(pins.length, 1);
  assertEquals(pins[0].name, "bar");
  assertEquals(pins[0].source, "github.com/y/repo");
  assertEquals(pins[0].sha, "abcdef0123456789abcdef0123456789abcdef01");
});

Deno.test("parsePinned throws on invalid entry", () => {
  assertThrows(
    () => parsePinned("bad: no-at-symbol"),
    Error,
    "invalid pinned.yaml"
  );
});

Deno.test("serializePins roundtrips with parsePinned", () => {
  const pins = [
    { name: "a", source: "github.com/a/r", sha: "a".repeat(40), branch: "main" },
    { name: "b", source: "github.com/b/r", sha: "b".repeat(40) },
  ];
  const out = serializePins(pins);
  const parsed = parsePinned(out);
  assertEquals(parsed.length, pins.length);
  assertEquals(parsed[0].name, pins[0].name);
  assertEquals(parsed[0].source, pins[0].source);
  assertEquals(parsed[0].sha, pins[0].sha);
  assertEquals(parsed[0].branch, pins[0].branch);
  assertEquals(parsed[1].name, pins[1].name);
  assertEquals(parsed[1].source, pins[1].source);
  assertEquals(parsed[1].sha, pins[1].sha);
});

Deno.test("serializePins outputs empty string for empty pins", () => {
  assertEquals(serializePins([]), "");
});
