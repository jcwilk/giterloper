/**
 * Unit tests for lib/pinned.ts (parsePinned, serializePins).
 * Note: readPins, mutatePins, etc. require fs and are tested via E2E.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { parsePinned, serializePins } from "../../.cursor/skills/gl/dist/pinned.js";

describe("parsePinned", () => {
  it("parses nested format", () => {
    const yaml = `k:
  repo: https://github.com/x/y
  sha: ${"a".repeat(40)}
  branch: main
`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
    assert.strictEqual(pins[0].name, "k");
    assert.strictEqual(pins[0].source, "https://github.com/x/y");
    assert.strictEqual(pins[0].sha, "a".repeat(40));
    assert.strictEqual(pins[0].branch, "main");
  });

  it("parses legacy one-liner format", () => {
    const yaml = `k: https://github.com/x/y@${"b".repeat(40)}
`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
    assert.strictEqual(pins[0].name, "k");
    assert.strictEqual(pins[0].source, "https://github.com/x/y");
    assert.strictEqual(pins[0].sha, "b".repeat(40));
  });

  it("skips comments and blank lines", () => {
    const yaml = `
# comment
k:
  repo: u
  sha: ${"c".repeat(40)}

`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
  });
});

describe("serializePins", () => {
  it("serializes with branch", () => {
    const pins = [
      { name: "k", source: "u", sha: "a".repeat(40), branch: "main" },
    ];
    const out = serializePins(pins);
    assert.ok(out.includes("repo: u"));
    assert.ok(out.includes("sha: " + "a".repeat(40)));
    assert.ok(out.includes("branch: main"));
  });

  it("serializes without branch", () => {
    const pins = [{ name: "k", source: "u", sha: "a".repeat(40) }];
    const out = serializePins(pins);
    assert.ok(!out.includes("branch"));
  });
});

describe("parsePinned + serializePins roundtrip", () => {
  it("roundtrips nested format", () => {
    const yaml = `k:
  repo: https://x
  sha: ${"a".repeat(40)}
  branch: b
`;
    const pins = parsePinned(yaml);
    const back = serializePins(pins);
    const again = parsePinned(back);
    assert.strictEqual(again.length, 1);
    assert.strictEqual(again[0].name, pins[0].name);
    assert.strictEqual(again[0].source, pins[0].source);
    assert.strictEqual(again[0].sha, pins[0].sha);
    assert.strictEqual(again[0].branch, pins[0].branch);
  });
});
