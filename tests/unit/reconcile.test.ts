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
  it("trims and sanitizes input", () => {
    assert.strictEqual(safeName("  foo bar  "), "foo-bar");
    assert.strictEqual(safeName("a.b_c-d"), "a.b_c-d");
    assert.strictEqual(safeName("spaces and!@#stuff"), "spaces-and-stuff");
  });
  it("returns 'entry' for empty result", () => {
    assert.strictEqual(safeName(""), "entry");
    assert.strictEqual(safeName("   ---   "), "entry");
    assert.strictEqual(safeName(null), "entry");
    assert.strictEqual(safeName(undefined), "entry");
  });
});

describe("makeQueueFilename", () => {
  it("uses nameArg when provided and adds .md if needed", () => {
    assert.strictEqual(makeQueueFilename("x", "my-file"), "my-file.md");
    assert.strictEqual(makeQueueFilename("x", "existing.md"), "existing.md");
  });
  it("uses content hash when nameArg is empty", () => {
    const fn = makeQueueFilename("hello world", null);
    assert.match(fn, /^[a-f0-9]{12}\.md$/);
  });
});

describe("parseSearchJson", () => {
  it("parses valid JSON array", () => {
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
  it("strips leading slashes", () => {
    assert.strictEqual(normalizeKnowledgeRelPath("/foo/bar"), "foo/bar");
  });
  it("strips knowledge/ prefix", () => {
    assert.strictEqual(normalizeKnowledgeRelPath("knowledge/foo.md"), "foo.md");
  });
  it("returns null for empty", () => {
    assert.strictEqual(normalizeKnowledgeRelPath(""), null);
    assert.strictEqual(normalizeKnowledgeRelPath(null), null);
  });
});

describe("chooseMatchedKnowledgePath", () => {
  it("picks first result with path", () => {
    assert.strictEqual(
      chooseMatchedKnowledgePath([{ path: "knowledge/foo.md" }]),
      "foo.md"
    );
  });
  it("tries filepath, file, docPath, docpath", () => {
    assert.strictEqual(
      chooseMatchedKnowledgePath([{ filepath: "knowledge/a.md" }]),
      "a.md"
    );
  });
  it("returns null when no candidate", () => {
    assert.strictEqual(chooseMatchedKnowledgePath([]), null);
    assert.strictEqual(chooseMatchedKnowledgePath([{}]), null);
  });
});
