/**
 * Unit tests for reconcile module (pure functions).
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  safeName,
  makeQueueFilename,
  parseSearchJson,
  normalizeKnowledgeRelPath,
  chooseMatchedKnowledgePath,
} from "../../.cursor/skills/gl/dist/reconcile.js";

describe("safeName", () => {
  it("returns cleaned string for valid input", () => {
    assert.strictEqual(safeName("foo-bar"), "foo-bar");
    assert.strictEqual(safeName("foo_bar"), "foo_bar");
    assert.strictEqual(safeName("foo.bar"), "foo.bar");
  });
  it("replaces invalid chars with dash", () => {
    assert.strictEqual(safeName("foo bar"), "foo-bar");
    assert.strictEqual(safeName("foo/bar"), "foo-bar");
  });
  it("strips leading/trailing dashes", () => {
    assert.strictEqual(safeName("--foo--"), "foo");
  });
  it("returns 'entry' for empty or blank", () => {
    assert.strictEqual(safeName(""), "entry");
    assert.strictEqual(safeName("   "), "entry");
    assert.strictEqual(safeName(null), "entry");
    assert.strictEqual(safeName(undefined), "entry");
  });
});

describe("makeQueueFilename", () => {
  it("uses nameArg when provided, ensures .md extension", () => {
    assert.strictEqual(makeQueueFilename("x", "foo"), "foo.md");
    assert.strictEqual(makeQueueFilename("x", "bar.md"), "bar.md");
    assert.strictEqual(makeQueueFilename("x", "baz.MD"), "baz.MD");
  });
  it("hashes content when nameArg not provided", () => {
    const out = makeQueueFilename("hello world", null);
    assert.match(out, /^[a-f0-9]{12}\.md$/);
    assert.strictEqual(makeQueueFilename("x", undefined), makeQueueFilename("x", undefined));
  });
});

describe("parseSearchJson", () => {
  it("parses valid JSON array", () => {
    assert.deepStrictEqual(parseSearchJson('[{"path":"a"}]'), [{ path: "a" }]);
  });
  it("wraps non-array in array", () => {
    assert.deepStrictEqual(parseSearchJson('{"x":1}'), []);
  });
  it("returns empty array on invalid JSON", () => {
    assert.deepStrictEqual(parseSearchJson("not json"), []);
  });
});

describe("normalizeKnowledgeRelPath", () => {
  it("strips leading slashes", () => {
    assert.strictEqual(normalizeKnowledgeRelPath("/foo"), "foo");
  });
  it("strips knowledge/ prefix", () => {
    assert.strictEqual(normalizeKnowledgeRelPath("knowledge/foo"), "foo");
    assert.strictEqual(normalizeKnowledgeRelPath("knowledge/a/b.md"), "a/b.md");
  });
  it("returns null for empty", () => {
    assert.strictEqual(normalizeKnowledgeRelPath(""), null);
    assert.strictEqual(normalizeKnowledgeRelPath(null), null);
  });
});

describe("chooseMatchedKnowledgePath", () => {
  it("returns first matching path from path/filepath/file/docPath/docpath", () => {
    assert.strictEqual(
      chooseMatchedKnowledgePath([{ path: "knowledge/x.md" }]),
      "x.md"
    );
    assert.strictEqual(
      chooseMatchedKnowledgePath([{ filepath: "knowledge/y.md" }]),
      "y.md"
    );
  });
  it("returns null when no candidate", () => {
    assert.strictEqual(chooseMatchedKnowledgePath([]), null);
    assert.strictEqual(chooseMatchedKnowledgePath([{}]), null);
  });
});
