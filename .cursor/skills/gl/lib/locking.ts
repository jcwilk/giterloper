/**
 * FIFO lock for coordinating access to shared resources.
 */
import { randomBytes } from "node:crypto";
import { readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXIT, fail } from "./errors.js";
import { ensureDir } from "./paths.js";

export interface WithFifoLockOptions {
  maxWaitMs?: number;
  pollMs?: number;
}

export function withFifoLock<T>(
  lockDir: string,
  fn: () => T,
  opts: WithFifoLockOptions = {}
): T {
  const maxWaitMs = opts.maxWaitMs ?? 5000;
  const pollMs = opts.pollMs ?? 25;
  ensureDir(lockDir);

  const staleCutoff = Date.now() - maxWaitMs * 2;
  const entries = readdirSync(lockDir);
  for (const e of entries) {
    const m = e.match(/^(\d+)_/);
    if (m && parseInt(m[1], 10) < staleCutoff) {
      try {
        unlinkSync(path.join(lockDir, e));
      } catch {
        /* ignore */
      }
    }
  }

  const ts = String(Date.now()).padStart(15, "0");
  const ticket = `${ts}_${process.pid}_${randomBytes(4).toString("hex")}`;
  const ticketPath = path.join(lockDir, ticket);
  writeFileSync(ticketPath, "", "utf8");

  try {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const files = readdirSync(lockDir).sort();
      if (files[0] === ticket) break;
      const d = Date.now() + pollMs;
      while (Date.now() < d) {
        /* busy wait */
      }
    }
    const files = readdirSync(lockDir).sort();
    if (files[0] !== ticket) {
      unlinkSync(ticketPath);
      fail(`could not acquire lock at ${lockDir} within ${maxWaitMs}ms`, EXIT.STATE);
    }
    return fn();
  } finally {
    try {
      unlinkSync(ticketPath);
    } catch {
      /* ignore */
    }
  }
}
