import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePinned, serializePins } from "../../lib/pinned.js";

describe("parsePinned", () => {
  it("parses nested format", () => {
    const yaml = `foo:
  repo: github.com/x/repo
  sha: 0123456789abcdef0123456789abcdef01234567
  branch: main
`;
    const pins = parsePinned(yaml);
    assert.equal(pins.length, 1);
    assert.equal(pins[0].name, "foo");
    assert.equal(pins[0].source, "github.com/x/repo");
    assert.equal(pins[0].sha, "0123456789abcdef0123456789abcdef01234567");
    assert.equal(pins[0].branch, "main");
  });

  it("parses legacy one-liner format", () => {
    const yaml = `bar: github.com/y/repo@abcdef0123456789abcdef0123456789abcdef01
`;
    const pins = parsePinned(yaml);
    assert.equal(pins.length, 1);
    assert.equal(pins[0].name, "bar");
    assert.equal(pins[0].source, "github.com/y/repo");
    assert.equal(pins[0].sha, "abcdef0123456789abcdef0123456789abcdef01");
  });

  it("throws on invalid entry", () => {
    assert.throws(
      () => parsePinned("bad: no-at-symbol"),
      /invalid pinned\.yaml/
    );
  });
});

describe("serializePins", () => {
  it("roundtrips with parsePinned", () => {
    const pins = [
      { name: "a", source: "github.com/a/r", sha: "a".repeat(40), branch: "main" },
      { name: "b", source: "github.com/b/r", sha: "b".repeat(40) },
    ];
    const out = serializePins(pins);
    const parsed = parsePinned(out);
    assert.equal(parsed.length, pins.length);
    assert.equal(parsed[0].name, pins[0].name);
    assert.equal(parsed[0].source, pins[0].source);
    assert.equal(parsed[0].sha, pins[0].sha);
    assert.equal(parsed[0].branch, pins[0].branch);
    assert.equal(parsed[1].name, pins[1].name);
    assert.equal(parsed[1].source, pins[1].source);
    assert.equal(parsed[1].sha, pins[1].sha);
  });

  it("outputs empty string for empty pins", () => {
    assert.equal(serializePins([]), "");
  });
});
