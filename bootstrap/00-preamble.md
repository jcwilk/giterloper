# Giterloper bootstrap

Giterloper manages git-based knowledge stores. This repository is the Giterloper application; it runs directly from here.

Essential pieces:
- `CONSTITUTION.md`: normative operation contract (copy; canonical lives in the knowledge store)
- `CONSTITUTION.md5`: checksum for verification
- `bootstrap/`: setup and verification
- `.cursor/skills/gl/`: the `gl` skill and CLI

Knowledge lives in separate repositories. The default knowledge store is [giterloper_knowledge](https://github.com/jcwilk/giterloper_knowledge). Connections are defined in `.giterloper/pinned.yaml`.

## Before you start

1. **Prerequisites**
   - `git`, Node.js >= 22 (or Bun), and QMD
   - CUDA Toolkit recommended for GPU acceleration (see 01-setup)

2. **Fixed layout**
   - Root: `.giterloper/`
   - `.giterloper/pinned.yaml` is committed
   - `.giterloper/versions/` and `.giterloper/staged/` are gitignored

3. **Run from this repo**
   - All `gl` commands run from the Giterloper project root
   - Use: `./.cursor/skills/gl/scripts/gl <command>`
