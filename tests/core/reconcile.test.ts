import { assertEquals } from "jsr:@std/assert";
import {
  collectH2Keys,
  comparePendingByAddEpoch,
  decomposePendingEntry,
  extractTopic,
  normalizeHeading,
  splitPreambleAndH2,
  splitTwoWays,
  stripBoilerplate,
  stripH2SectionsMatching,
  type PendingEntry,
} from "../../lib/reconcile.ts";

Deno.test("extractTopic uses first # heading", () => {
  assertEquals(extractTopic("# Foo Bar\n\nbody", "x.md"), "foo-bar");
  assertEquals(extractTopic("# API Design\ncontent", "a.md"), "api-design");
});

Deno.test("extractTopic falls back to filename stem when no heading", () => {
  assertEquals(extractTopic("plain text", "my-topic.md"), "my-topic");
  assertEquals(extractTopic("", "fallback.md"), "fallback");
});

Deno.test("extractTopic sanitizes for filename", () => {
  assertEquals(extractTopic("# Foo: Bar! (v1)", "x.md"), "foo-bar-v1");
});

Deno.test("stripBoilerplate collapses multiple newlines", () => {
  assertEquals(stripBoilerplate("a\n\n\n\nb"), "a\n\nb");
  assertEquals(stripBoilerplate("x\n\n\ny\n\nz"), "x\n\ny\n\nz");
});

Deno.test("splitPreambleAndH2 separates intro and H2 sections", () => {
  const { preamble, h2sections } = splitPreambleAndH2("# T\n\nintro\n\n## A\n\na\n\n## B\n\nb");
  assertEquals(preamble.includes("# T"), true);
  assertEquals(h2sections.length, 2);
  assertEquals(h2sections[0].title, "A");
  assertEquals(h2sections[1].title, "B");
});

Deno.test("decomposePendingEntry yields at least two corpus paths", () => {
  const entry: PendingEntry = {
    path: "knowledge/_pending/x.md",
    addEpoch: 1,
    content: "# One Topic\n\nOnly body no H2.",
  };
  const chunks = decomposePendingEntry(entry);
  assertEquals(chunks.length >= 2, true);
  assertEquals(chunks[0].relPath.startsWith("knowledge/one-topic/"), true);
  assertEquals(chunks[0].pendingBasename, "x.md");
});

Deno.test("decomposePendingEntry splits multiple H2 into multiple files", () => {
  const entry: PendingEntry = {
    path: "knowledge/_pending/y.md",
    addEpoch: 1,
    content: "# T\n\n## First\n\na\n\n## Second\n\nb",
  };
  const chunks = decomposePendingEntry(entry);
  assertEquals(chunks.length, 2);
  assertEquals(chunks.every((c) => c.relPath.includes("knowledge/t/")), true);
});

Deno.test("stripH2SectionsMatching removes H2 keys present in set", () => {
  const keys = new Set([normalizeHeading("Status")]);
  const md = "# X\n\n## Status\n\nold\n\n## Other\n\nkeep";
  const out = stripH2SectionsMatching(md, keys);
  assertEquals(out.includes("old"), false);
  assertEquals(out.includes("keep"), true);
});

Deno.test("collectH2Keys lists normalized headings", () => {
  assertEquals(collectH2Keys("## Foo Bar\n\nx"), [normalizeHeading("Foo Bar")]);
});

Deno.test("splitTwoWays splits at paragraph boundary", () => {
  const [a, b] = splitTwoWays("line1\n\nline2");
  assertEquals(a.includes("line1"), true);
  assertEquals(b.includes("line2"), true);
});

Deno.test("comparePendingByAddEpoch orders by addEpoch ascending with addEpoch 0 last", () => {
  const entries: PendingEntry[] = [
    { path: "knowledge/_pending/a.md", addEpoch: 100, content: "" },
    { path: "knowledge/_pending/b.md", addEpoch: 0, content: "" },
    { path: "knowledge/_pending/c.md", addEpoch: 50, content: "" },
  ];
  entries.sort(comparePendingByAddEpoch);
  assertEquals(entries.map((e) => e.addEpoch), [50, 100, 0]);
});
