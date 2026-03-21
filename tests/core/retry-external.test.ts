import { assertEquals } from "jsr:@std/assert";

import {
  computeBackoffMs,
  githubResponseRetry,
  gitArgsTouchNetwork,
  gitTransientMessage,
} from "../../lib/retry-external.ts";

Deno.test("githubResponseRetry uses retry-after seconds", () => {
  const res = new Response("", {
    status: 503,
    headers: { "retry-after": "3" },
  });
  const d = githubResponseRetry(res, "", {});
  assertEquals(d.retry, true);
  assertEquals(d.waitMs, 3000);
});

Deno.test("githubResponseRetry rate-limited 403 with body", () => {
  const res = new Response("", {
    status: 403,
    headers: {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
    },
  });
  const d = githubResponseRetry(res, "API rate limit exceeded", {});
  assertEquals(d.retry, true);
  assertEquals(d.waitMs > 0, true);
});

Deno.test("githubResponseRetry 401 and 422 are not retried", () => {
  assertEquals(githubResponseRetry(new Response("", { status: 401 }), "", {}).retry, false);
  assertEquals(githubResponseRetry(new Response("", { status: 422 }), "", {}).retry, false);
});

Deno.test("githubResponseRetry merge 409 is not retried", () => {
  assertEquals(
    githubResponseRetry(new Response("", { status: 409 }), "", { isMergePost: true }).retry,
    false
  );
});

Deno.test("gitTransientMessage recognizes common network flakes", () => {
  assertEquals(gitTransientMessage("Connection timed out"), true);
  assertEquals(gitTransientMessage("Authentication failed"), false);
});

Deno.test("gitArgsTouchNetwork detects ls-remote after -C", () => {
  assertEquals(gitArgsTouchNetwork(["-C", "/tmp/r", "ls-remote", "origin"]), true);
  assertEquals(gitArgsTouchNetwork(["-C", "/tmp/r", "rev-parse", "HEAD"]), false);
});

Deno.test("computeBackoffMs is positive and bounded", () => {
  const ms = computeBackoffMs(2, 100, 10_000);
  assertEquals(ms > 0 && ms <= 10_000, true);
});
