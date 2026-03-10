# Open Issues

Current open issues identified during development.

## Promote / `clonePin`: `git checkout` "unable to read tree"

**Observed:** The promote flow (and other flows that call `updatePinSha`) sometimes fails with:
```
fatal: unable to read tree (2d044f69e413aa6d1a119732b4d2fb254d6a66ba)
```

**When it occurs:** During `clonePin` in `lib/pin-lifecycle.ts` when running `git checkout <sha>` (line 97) inside a freshly cloned repository. The clone is created with `git clone --depth 1`, then we immediately run `git checkout <sha>`.

**Root cause:** Shallow clones (`--depth 1`) fetch only the single commit at the tip of the specified branch (or default branch). The tree and blob objects for that commit are present, but any *other* commit's objects are not. When we `checkout <sha>`:

- If the SHA equals the tip we just cloned, checkout succeeds.
- If the SHA is an ancestor of the tip (e.g. an older commit on the same branch), git may or may not have it depending on how the server sent the pack. With `--depth 1`, typically only the tip commit and its tree are present; parent commits are not.
- If the SHA is on a different branch than we cloned, it is almost certainly missing.

The promote flow pushes a new commit to the pin's branch, then calls `updatePinSha` with the new SHA. We clone with `--branch <pin.branch>`, so we get the tip of that branch—which *should* be the commit we just pushed. In theory the new SHA is at the tip. In practice, failures can occur due to:

1. **Race:** Remote refs are not yet visible when we clone (eventual consistency, CDN, etc.).
2. **Stale refs:** We clone `--branch X` but the local view of the branch is outdated; the server returns an older tip.
3. **Different ref path:** The SHA is reachable from a different ref but not from the branch tip we cloned (e.g. branch was force-pushed, or we're on a detached state).
4. **Git server behavior:** Some servers may omit certain objects in shallow packs even for the tip.

**Fix directions:**

1. **Unshallow before checkout (targeted):** After cloning with `--depth 1`, run `git fetch --depth 1 <remote> <sha>:` to fetch that specific commit if `checkout` fails, then retry checkout. This keeps clones shallow when possible but fetches the exact commit when needed.

2. **Increase depth for promote:** Use `--depth 50` (or similar) when cloning for `updatePinSha` in promote flows, so recent ancestors are present. Trade-off: larger clones and more transfer.

3. **Clone with explicit ref:** Use `git clone --depth 1 <url> --reference <sha>` or equivalent if the server supports it. Git's `--depth` with `--branch` should include the branch tip; the failure suggests the tip we receive is not the expected SHA.

4. **Retry with unshallow:** On "unable to read tree", run `git fetch --unshallow` then retry `checkout`. Fallback only when needed; full history can be large.

5. **Verify before checkout:** Run `git rev-parse --verify <sha>^{commit}` in the clone before checkout. If it fails, the object is missing—fetch it explicitly (`git fetch origin <sha>`) then checkout.
