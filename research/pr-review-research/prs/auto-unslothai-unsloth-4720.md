# unslothai/unsloth #4720 — Add AMD ROCm/HIP support across installer and hardware detection

**[View PR on GitHub](https://github.com/unslothai/unsloth/pull/4720)**

| | |
|---|---|
| **Author** | @danielhanchen |
| **Status** | ✅ merged |
| **Opened** | 2026-03-31 |
| **Repo importance** | ★65,854 · 5,886 forks · score 94,397 |
| **Diff** | +1875 / −116 across 13 files |
| **Engagement** | 32 conversation · 86 inline review comments |

## Top review comments (ranked by reactions)

### @iswaryaalex — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/4720#issuecomment-4180340442)

> @danielhanchen new PR https://github.com/unslothai/unsloth/pull/4770 to this branch to support AMD Radeon specific pytorch installs and autodetection of platform

### @danielhanchen — 0 reactions  
`—`  ·  [link](https://github.com/unslothai/unsloth/pull/4720#issuecomment-4217353093)

> ## AMD ROCm Testing Report -- MI300X VF (ROCm 7.2, HIP 7.1.25424)
> 
> ### Environment
> - **GPU**: AMD Instinct MI300X VF (192GB VRAM, gfx942 CDNA3)
> - **ROCm**: 7.2.0, HIP 7.1.25424
> - **PyTorch**: 2.10.0+rocm7.1
> - **Unsloth**: 2026.4.4
> - **Transformers**: 4.57.6
> 
> ### Fixes Added (3 commits)
> 
> 1. **`install.sh` + `install_python_stack.py`** (83567f59): Prevent bitsandbytes from overwriting ROCm torch with CUDA wheels (`--no-deps` + post-install repair).
> 
> 2. **`inference.py`** (7cbc51d9 + 98f02151): ROCm inference fallback -- Unsloth's patched kernels and bnb 4-bit crash on HIP during inference. On ROCm, skips Unsloth import (prevents global monkey-patching), loads models in 16-bit with plain transformers+PEFT, resolves pre-quantized model names. NVIDIA path is byte-for-byte unchanged.
> 
> 3. **`amd.py`** (4a87946d): Fix amd-smi parsing for newer output format -- `gpu_data` envelope unwrapping, `mem_usage` key for VRAM, temperature fallback from `edge` (N/A on VF) to `hotspot`.
> 
> ### Test Results
> 
> #### Studio Launch & Hardware Detection
> | Check | Result |
> |-------|--------|
> | `device_backend: "rocm"` | PASS |
> | GPU name: AMD Instinct MI300X VF | PASS |
> | VRAM: 191.69 GB | PASS |
> | `chat_only: false` | PASS |
> 
> #### GGUF Inference (4 models, all PASS)
> | Model | Variant | Quality |
> |-------|---------|---------|
> | Qwen3.5-4B-GGUF | Q4_K_XL | Correct: math, creative, knowledge |
> | gemma-3-4b-it-GGUF | Q4_K_M | Correct: math, creative, knowledge |
> | Llama-3.2-3B-Instruct-GGUF | Q4_K_M | Correct: math, creative, knowledge |
> | Llama-3.2-1B-Instruct-GGUF | Q4_K_M | Correct: math, creative, know … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
