import { assertEquals } from "jsr:@std/assert";
import {
  extractTopic,
  groupByTopic,
  mergeTopicContent,
  stripBoilerplate,
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

Deno.test("groupByTopic groups by extracted topic", () => {
  const entries = [
    { path: "knowledge/_pending/a.md", addEpoch: 1, content: "# Foo\nx" },
    { path: "knowledge/_pending/b.md", addEpoch: 2, content: "# Foo\ny" },
    { path: "knowledge/_pending/c.md", addEpoch: 3, content: "# Bar\nz" },
  ];
  const map = groupByTopic(entries);
  assertEquals(map.get("foo")?.length, 2);
  assertEquals(map.get("bar")?.length, 1);
});

Deno.test("mergeTopicContent builds merged content with Sources", () => {
  const entries = [
    { path: "knowledge/_pending/f1.md", addEpoch: 1, content: "body one" },
    { path: "knowledge/_pending/f2.md", addEpoch: 2, content: "body two" },
  ];
  const out = mergeTopicContent(null, entries);
  assertEquals(out.includes("body one"), true);
  assertEquals(out.includes("body two"), true);
  assertEquals(out.includes("## Sources"), true);
  assertEquals(out.includes("`f1.md`"), true);
  assertEquals(out.includes("`f2.md`"), true);
});

Deno.test("mergeTopicContent appends to existing", () => {
  const entries = [
    { path: "knowledge/_pending/new.md", addEpoch: 1, content: "new content" },
  ];
  const out = mergeTopicContent("existing body", entries);
  assertEquals(out.includes("existing body"), true);
  assertEquals(out.includes("new content"), true);
  assertEquals(out.includes("---"), true);
});
