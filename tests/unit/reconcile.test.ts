import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  safeName,
  makeQueueFilename,
  parseSearchJson,
  normalizeKnowledgeRelPath,
  chooseMatchedKnowledgePath,
} from "../../lib/reconcile.js";

describe("safeName", () => {
  it("trims and replaces invalid chars with dashes", () => {
    assert.equal(safeName("  foo bar  "), "foo-bar");
  });
  it("strips leading/trailing dashes", () => {
    assert.equal(safeName("---x---"), "x");
  });
  it("returns 'entry' for empty or whitespace", () => {
    assert.equal(safeName(""), "entry");
    assert.equal(safeName("   "), "entry");
    assert.equal(safeName(null), "entry");
    assert.equal(safeName(undefined), "entry");
  });
  it("allows alphanumeric, dot, underscore, hyphen", () => {
    assert.equal(safeName("a-z_A.Z-0"), "a-z_A.Z-0");
  });
});

describe("makeQueueFilename", () => {
  it("uses nameArg when provided, appends .md if needed", () => {
    assert.equal(makeQueueFilename("", "my topic"), "my-topic.md");
    assert.equal(makeQueueFilename("", "already.md"), "already.md");
  });
  it("hashes content when nameArg is null/undefined", () => {
    const h1 = makeQueueFilename("hello", undefined);
    const h2 = makeQueueFilename("hello", null);
    assert.ok(h1.endsWith(".md"));
    assert.ok(h1.length >= 13 && h1.length <= 20); // 12 hex + ".md" or similar
    assert.equal(h1, h2);
  });
});

describe("parseSearchJson", () => {
  it("parses array JSON", () => {
    assert.deepEqual(parseSearchJson('[{"path":"a"}]'), [{ path: "a" }]);
  });
  it("returns empty array for non-array", () => {
    assert.deepEqual(parseSearchJson('{"path":"a"}'), []);
  });
  it("returns empty array for invalid JSON", () => {
    assert.deepEqual(parseSearchJson("not json"), []);
  });
});

describe("normalizeKnowledgeRelPath", () => {
  it("strips leading slashes", () => {
    assert.equal(normalizeKnowledgeRelPath("/foo/bar"), "foo/bar");
  });
  it("strips knowledge/ prefix", () => {
    assert.equal(normalizeKnowledgeRelPath("knowledge/foo.md"), "foo.md");
  });
  it("returns null for empty", () => {
    assert.equal(normalizeKnowledgeRelPath(""), null);
    assert.equal(normalizeKnowledgeRelPath(null), null);
  });
});

describe("chooseMatchedKnowledgePath", () => {
  it("picks path from first result with path", () => {
    assert.equal(
      chooseMatchedKnowledgePath([{ path: "knowledge/a.md" }]),
      "a.md"
    );
  });
  it("tries filepath, file, docPath, docpath", () => {
    assert.equal(chooseMatchedKnowledgePath([{ filepath: "knowledge/b.md" }]), "b.md");
    assert.equal(chooseMatchedKnowledgePath([{ file: "knowledge/c.md" }]), "c.md");
  });
  it("returns null when no candidate", () => {
    assert.equal(chooseMatchedKnowledgePath([{}]), null);
    assert.equal(chooseMatchedKnowledgePath([]), null);
  });
});
