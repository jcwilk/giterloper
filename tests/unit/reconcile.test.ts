/**
 * Unit tests for lib/reconcile.ts
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
  it("returns clean alphanumeric string", () => {
    assert.strictEqual(safeName("foo"), "foo");
    assert.strictEqual(safeName("foo-bar"), "foo-bar");
  });
  it("replaces invalid chars with dash", () => {
    assert.strictEqual(safeName("foo bar"), "foo-bar");
    assert.strictEqual(safeName("a/b/c"), "a-b-c");
  });
  it("strips leading/trailing dashes", () => {
    assert.strictEqual(safeName("--foo--"), "foo");
  });
  it("returns entry for empty or whitespace", () => {
    assert.strictEqual(safeName(""), "entry");
    assert.strictEqual(safeName("   "), "entry");
    assert.strictEqual(safeName("---"), "entry");
  });
  it("handles null/undefined", () => {
    assert.strictEqual(safeName(null), "entry");
    assert.strictEqual(safeName(undefined), "entry");
  });
});

describe("makeQueueFilename", () => {
  it("uses nameArg when provided, adds .md if missing", () => {
    assert.strictEqual(makeQueueFilename("x", "my-doc"), "my-doc.md");
    assert.strictEqual(makeQueueFilename("x", "my-doc.md"), "my-doc.md");
  });
  it("hashes content when nameArg not provided", () => {
    const f = makeQueueFilename("hello world", null);
    assert.ok(/^[a-f0-9]{12}\.md$/.test(f), f);
    assert.strictEqual(makeQueueFilename("hello world", undefined).length, 15);
  });
});

describe("parseSearchJson", () => {
  it("parses array JSON", () => {
    assert.deepStrictEqual(parseSearchJson('[{"path":"a"}]'), [{ path: "a" }]);
  });
  it("returns empty array for non-array", () => {
    assert.deepStrictEqual(parseSearchJson('{"x":1}'), []);
  });
  it("returns empty array for invalid JSON", () => {
    assert.deepStrictEqual(parseSearchJson("not json"), []);
  });
});

describe("normalizeKnowledgeRelPath", () => {
  it("strips knowledge/ prefix", () => {
    assert.strictEqual(normalizeKnowledgeRelPath("knowledge/foo.md"), "foo.md");
  });
  it("strips leading slashes", () => {
    assert.strictEqual(normalizeKnowledgeRelPath("/foo"), "foo");
  });
  it("returns null for empty", () => {
    assert.strictEqual(normalizeKnowledgeRelPath(""), null);
    assert.strictEqual(normalizeKnowledgeRelPath(null), null);
  });
  it("passes through path without knowledge/ prefix", () => {
    assert.strictEqual(normalizeKnowledgeRelPath("foo.md"), "foo.md");
  });
});

describe("chooseMatchedKnowledgePath", () => {
  it("picks first candidate with path", () => {
    assert.strictEqual(
      chooseMatchedKnowledgePath([{ path: "knowledge/a.md" }]),
      "a.md"
    );
  });
  it("tries path, filepath, file, docPath, docpath", () => {
    assert.strictEqual(
      chooseMatchedKnowledgePath([{ filepath: "knowledge/x.md" }]),
      "x.md"
    );
    assert.strictEqual(
      chooseMatchedKnowledgePath([{ file: "knowledge/y.md" }]),
      "y.md"
    );
  });
  it("returns null when no candidate", () => {
    assert.strictEqual(chooseMatchedKnowledgePath([]), null);
    assert.strictEqual(chooseMatchedKnowledgePath([{}]), null);
  });
});
