/**
 * Unit tests for lib/pinned.ts - parsePinned, serializePins (roundtrip, edge cases).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { parsePinned, serializePins } from "../../.cursor/skills/gl/dist/pinned.js";

describe("parsePinned", () => {
  it("parses nested format", () => {
    const yaml = `mypin:
  repo: github.com/org/repo
  sha: abc1234567890123456789012345678901234567
  branch: main`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
    assert.strictEqual(pins[0].name, "mypin");
    assert.strictEqual(pins[0].source, "github.com/org/repo");
    assert.strictEqual(pins[0].sha, "abc1234567890123456789012345678901234567");
    assert.strictEqual(pins[0].branch, "main");
  });
  it("parses legacy one-liner format", () => {
    const yaml = `legacy: github.com/x/y@abcdef0123456789abcdef0123456789abcdef01`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
    assert.strictEqual(pins[0].name, "legacy");
    assert.strictEqual(pins[0].source, "github.com/x/y");
    assert.strictEqual(pins[0].sha, "abcdef0123456789abcdef0123456789abcdef01");
    assert.strictEqual(pins[0].branch, undefined);
  });
  it("parses multiple pins", () => {
    const yaml = `a:
  repo: r1
  sha: ${"0".repeat(40)}
b:
  repo: r2
  sha: ${"1".repeat(40)}
  branch: br`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 2);
    assert.strictEqual(pins[0].name, "a");
    assert.strictEqual(pins[1].name, "b");
    assert.strictEqual(pins[1].branch, "br");
  });
  it("skips comments and blank lines", () => {
    const yaml = `# comment
    
p:
  repo: r
  sha: ${"a".repeat(40)}`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
  });
});

describe("serializePins", () => {
  it("serializes pin without branch", () => {
    const pins = [{ name: "x", source: "s", sha: "a".repeat(40) }];
    const out = serializePins(pins);
    assert.ok(out.includes("x:"));
    assert.ok(out.includes("repo: s"));
    assert.ok(out.includes("sha: " + "a".repeat(40)));
    assert.ok(!out.includes("branch"));
  });
  it("serializes pin with branch", () => {
    const pins = [{ name: "x", source: "s", sha: "a".repeat(40), branch: "main" }];
    const out = serializePins(pins);
    assert.ok(out.includes("branch: main"));
  });
});

describe("roundtrip", () => {
  it("parse then serialize preserves data", () => {
    const yaml = `mypin:
  repo: github.com/org/repo
  sha: abc1234567890123456789012345678901234567
  branch: main`;
    const pins = parsePinned(yaml);
    const out = serializePins(pins);
    const pins2 = parsePinned(out);
    assert.deepStrictEqual(pins, pins2);
  });
});
