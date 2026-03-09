/**
 * Unit tests for pinned module (parsePinned, serializePins).
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { parsePinned, serializePins } from "../../.cursor/skills/gl/dist/pinned.js";

const FAKE_SHA = "a".repeat(40);

describe("parsePinned", () => {
  it("parses nested format", () => {
    const yaml = `p1:
  repo: github.com/x/y
  sha: ${FAKE_SHA}
  branch: main
`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
    assert.deepStrictEqual(pins[0], {
      name: "p1",
      source: "github.com/x/y",
      sha: FAKE_SHA,
      branch: "main",
    });
  });

  it("parses legacy one-liner format", () => {
    const yaml = `p1: github.com/x/y@${FAKE_SHA}\n`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
    assert.deepStrictEqual(pins[0], {
      name: "p1",
      source: "github.com/x/y",
      sha: FAKE_SHA,
    });
  });

  it("ignores comments and blank lines", () => {
    const yaml = `# comment
p1:
  repo: github.com/x/y
  sha: ${FAKE_SHA}

`;
    const pins = parsePinned(yaml);
    assert.strictEqual(pins.length, 1);
    assert.strictEqual(pins[0].name, "p1");
  });

  it("throws for invalid SHA", () => {
    assert.throws(
      () => parsePinned(`p1:\n  repo: x\n  sha: badsha\n`),
      /invalid pinned.yaml/
    );
  });
});

describe("serializePins", () => {
  it("serializes pins with branch", () => {
    const pins = [
      { name: "p1", source: "github.com/x/y", sha: FAKE_SHA, branch: "main" },
    ];
    const out = serializePins(pins);
    assert.ok(out.includes("p1:"));
    assert.ok(out.includes("repo: github.com/x/y"));
    assert.ok(out.includes("sha: " + FAKE_SHA));
    assert.ok(out.includes("branch: main"));
  });

  it("omits branch when undefined", () => {
    const pins = [{ name: "p1", source: "github.com/x/y", sha: FAKE_SHA }];
    const out = serializePins(pins);
    assert.ok(!out.includes("branch:"));
  });

  it("roundtrips with parsePinned", () => {
    const pins = [
      { name: "p1", source: "gh.com/a/b", sha: FAKE_SHA, branch: "main" },
      { name: "p2", source: "gh.com/c/d", sha: "b".repeat(40) },
    ];
    const serialized = serializePins(pins);
    const parsed = parsePinned(serialized);
    assert.strictEqual(parsed.length, 2);
    assert.deepStrictEqual(parsed[0], pins[0]);
    assert.strictEqual(parsed[1].name, pins[1].name);
    assert.strictEqual(parsed[1].source, pins[1].source);
    assert.strictEqual(parsed[1].sha, pins[1].sha);
  });
});
