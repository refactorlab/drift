# unslothai/unsloth #5050 — Studio: Ollama support, recommended folders, Custom Folders UX polish

**[View PR on GitHub](https://github.com/unslothai/unsloth/pull/5050)**

| | |
|---|---|
| **Author** | @danielhanchen |
| **Status** | ✅ merged |
| **Opened** | 2026-04-16 |
| **Repo importance** | ★65,854 · 5,886 forks · score 94,397 |
| **Diff** | +500 / −35 across 6 files |
| **Engagement** | 20 conversation · 41 inline review comments |

## Top review comments (ranked by reactions)

### @danielhanchen — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/5050#issuecomment-4259234690)

> Thanks for the review, pushed `b7e28b2b` addressing both the silent-exception warnings and the two P1 findings:
> 
> **Silent exception logging (gemini lines 443, 458, 472, 523, 735):** replaced the broad `except Exception: pass` / `except OSError: return []` blocks in `_scan_ollama_dir` and the recommended-folders endpoint with narrower exception types (`_json.JSONDecodeError, OSError`) plus `logger.debug` or `logger.warning` calls so the failures are diagnosable.
> 
> **P1 read-only Ollama directories (Codex line 443):** system installs of Ollama store models at `/usr/share/ollama/.ollama/models` or `/var/lib/ollama/.ollama/models` where the Studio process often has read-but-not-write access. Previously the scanner returned an empty list when `.studio_links/` couldn't be created inside the Ollama directory, so all Ollama models silently disappeared from Custom Folders.
> 
> Added a `_ollama_links_dir` helper that falls back to a per-ollama-dir hashed namespace under Studio's own cache (`~/.unsloth/studio/cache/ollama_links/<sha1-of-ollama-path>/`) when the primary location is not writable. Hash keeps two different Ollama roots on the same machine from colliding.
> 
> **P1 no-symlink fallback entries can't load (Codex line 493):** the old fallback path returned the raw blob path (`sha256-...`) without a `.gguf` suffix, so `detect_gguf_model` would later reject it. Removed that path entirely; the new design keeps the `.gguf` suffix on every symlink we surface (either under `.studio_links/` or the Studio cache), so the load pipeline works uniformly regardless of which filesystem the links l … *[truncated]*

### @danielhanchen — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/5050#issuecomment-4259310779)

> One more fix pushed in \`3f1d7253\`:
> 
> **Codex P1 on model_config.py:1012 (mmproj next to symlink target):** the previous commit switched \`detect_gguf_model\` to \`os.path.abspath\` to preserve the readable symlink name, but that left \`detect_mmproj_file\` searching the symlink's parent directory instead of the target's. For vision GGUFs surfaced via Ollama's \`.studio_links/\` (or any user-created symlink setup) where the mmproj sidecar lives next to the real blob rather than next to the symlink, mmproj detection would fail and the model would be misclassified as text-only.
> 
> \`detect_mmproj_file\` now adds the resolved target's parent to the scan order when \`path\` is a symlink. Direct (non-symlink) \`.gguf\` paths are untouched, so LM Studio and HF cache layouts keep working identically.
> 
> Verified with a fake layout that reproduces the exact failure:
> 
> \`\`\`
> /real/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q4_K_M.gguf
> /real/Qwen3.5-4B-GGUF/mmproj-Qwen3.5-4B-BF16.gguf
> /links/my.gguf -> /real/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q4_K_M.gguf
> \`\`\`
> 
> \`detect_mmproj_file("/links/my.gguf")\` now returns \`/real/.../mmproj-Qwen3.5-4B-BF16.gguf\` (previously \`None\`). Regression check with a non-symlink LM Studio path still finds its sibling mmproj as before.

### @danielhanchen — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/5050#issuecomment-4259770741)

> Addressed both findings from the Gemini review in 6a7fca17:
> 
> **HIGH -- Ollama scanner hardcoded to \`library\` namespace:**
> - Now iterates over all directories under \`registry.ollama.ai/\` (e.g. \`library\`, \`mradermacher\`, etc.)
> - Custom namespace models display as \`namespace/model:tag\` and include the namespace in symlink names to avoid collisions
> - Default \`library\` namespace models still display as \`model:tag\` (no change)
> 
> **MEDIUM -- Vision projector layer not surfaced:**
> - Ollama vision models with an \`application/vnd.ollama.image.projector\` layer now get a companion \`-mmproj.gguf\` symlink created alongside the model symlink
> - This lets \`detect_mmproj_file\` find the projector automatically

### @danielhanchen — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/5050#issuecomment-4259917528)

> Addressed all four findings in 4edcdc1d:
> 
> - **Imports**: Moved \`hashlib\` and \`json\` to top-level imports (PEP 8). Removed inline \`import hashlib\` and \`import json as _json\` from function bodies.
> - **Scan limit**: Added \`limit\` parameter to \`_scan_ollama_dir()\` with early return when the threshold is reached. Call site now passes \`_MAX_MODELS_PER_FOLDER\` directly so large Ollama directories don't cause unbounded traversals.

### @danielhanchen — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/5050#issuecomment-4260160428)

> Pushed 11890d5f addressing all findings from the 20-reviewer run:
> 
> **[19/20] Windows symlink failure:**
> - `_make_link()` now tries symlink -> hardlink (`os.link`) -> file copy (`shutil.copy2`)
> - Uses atomic `os.replace` via tmp file to avoid race window during rescan
> 
> **[7/20] Scanner misses hf.co and non-default registry hosts:**
> - Now uses `rglob("*")` over `manifests/` instead of hardcoding `registry.ollama.ai`
> - Discovers `hf.co/org/repo:tag`, custom namespaces, and any other host layout
> - Display names adapt: `library/qwen2.5/0.5b` -> `qwen2.5:0.5b`, `hf.co/NbAiLab/borealis/q4_K_M` -> `hf.co/NbAiLab/borealis:q4_K_M`
> 
> **[3/20] Symlink name collisions:**
> - Generated filenames now include a stable sha1 hash (10 chars) of the full manifest path
> - `library/foo-bar:baz` and `foo/bar:baz` get distinct link names
> 
> **[2/20] mmproj cross-contamination:**
> - Each model's links live in their own hash-keyed subdirectory under `.studio_links/`
> - `detect_mmproj_file` only sees the projector for that specific model
> 
> **[17/20] Friendly Ollama error misses fallback cache path:**
> - Now also matches `ollama_links/` path segment and `model_identifier` starting with `ollama/`
> - Read-only system Ollama installs using the fallback cache get the proper error message
> 
> **[1/20] Recommended folders advertise unreadable directories:**
> - Added `os.access(R_OK | X_OK)` check so unreadable system directories are filtered out

### @danielhanchen — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/5050#issuecomment-4260385824)

> Fixed in bbc5d285 -- added \`ollama_links\` to the generic scanner filter alongside \`.studio_links\`.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
