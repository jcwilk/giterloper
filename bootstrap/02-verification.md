## Verification

After setup, prefer CLI-driven checks first, then manual fallbacks.

1. **CLI status**
   - Run: `node <skills-dir>/gl/scripts/gl.mjs status`
   - Confirm expected pin exists, clone path exists, and collection name is `<name>@<sha>`.

2. **CLI verify**
   - Run: `node <skills-dir>/gl/scripts/gl.mjs verify`
   - Confirm it passes for expected pin(s).

3. **Manual fallback checks (if needed)**
   - `git --version`, `qmd status`
   - `.giterloper/pinned.yaml` exists and pin uses full 40-character SHA
   - `.giterloper/versions/<name>/<sha>/` exists with `knowledge/`, `CONSTITUTION.md`, `INSTRUCTIONS.md`
   - `.gitignore` includes:
     - `.giterloper/versions/`
     - `.giterloper/staged/`
   - `qmd collection list` contains `<name>@<sha>`
   - `qmd status` indicates vectors are non-zero for that collection
   - `qmd search "<topic>" -c <name>@<sha>` returns relevant matches

4. **Operational sanity**
   - Run a simple read operation via the skill (`gl search` or `gl query`) and confirm grounded output with path citations.

If verification fails, report exactly which check failed and rerun only the relevant installation step.
## Verification

After setup:

1. **Prerequisites:** Confirm `git` and QMD are installed (`git --version`, `qmd status`).
2. **pinned.yaml:** Confirm `.giterloper/pinned.yaml` exists and contains the expected store entry with a full commit SHA (e.g. `giterloper: github.com/jcwilk/giterloper@a1b2c3d4...`). Verify the ref is a 40-character hex SHA, not a branch name or tag.
3. **Clone:** Confirm the clone exists at `.giterloper/versions/<name>/<sha>/` with `knowledge/`, `CONSTITUTION.md`, and `INSTRUCTIONS.md`. Verify constitution with `CONSTITUTION.md5` from the store.
4. **Gitignore:** Confirm both `.giterloper/versions/` and `.giterloper/staged/` are in `.gitignore` (not the entire `.giterloper/` directory — `pinned.yaml` should be committed).
5. **GPU acceleration:** Run `qmd status` and inspect the `Device` section. If it shows an accelerated backend such as `GPU: CUDA (...)` or Vulkan, acceleration is working. If it shows `GPU: none` on a machine with NVIDIA hardware, revisit the CUDA Toolkit prerequisite and the `node-llama-cpp` rebuild step from `bootstrap/01-installation.md`. If no usable GPU backend exists, note that model-backed commands will be slower but should still work.
6. **QMD collection:** Confirm `qmd collection list` shows the collection. Run `qmd status` and verify the collection's `Vectors` count is non-zero and broadly in line with the `Documents: Total` count. Then run `qmd search "<topic>" -c <name>@<sha>` to verify results. If vectors are missing or unexpectedly low, re-run `qmd embed` and re-check before treating setup as complete.
7. **General access:** Use the corresponding skill for `answer_from_context` to check relevant to the knowledge store and present it to the user. Make sure to analyze how the skill was performed to compare it to expectations, it should indicate whether the models/embeddings/etc are being leveraged and functioning correctly.

If anything is missing or incorrect, inform the user and if they give you permission to proceed, repeat the relevant step and retry verification.
