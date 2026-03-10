import { assertEquals } from "jsr:@std/assert";
import { parseGithubRepo } from "../../lib/git.ts";

Deno.test("parseGithubRepo extracts owner/repo from github.com URL", () => {
  assertEquals(parseGithubRepo("github.com/jcwilk/giterloper_test_knowledge"), "jcwilk/giterloper_test_knowledge");
  assertEquals(parseGithubRepo("https://github.com/jcwilk/foo"), "jcwilk/foo");
  assertEquals(parseGithubRepo("git@github.com:owner/repo.git"), "owner/repo");
});

Deno.test("parseGithubRepo returns null for non-GitHub sources", () => {
  assertEquals(parseGithubRepo("gitlab.com/owner/repo"), null);
  assertEquals(parseGithubRepo("example.com/bar"), null);
});
