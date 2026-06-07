# unslothai/unsloth #5301 — fix/strix halo and windows AMD ROCm support

**[View PR on GitHub](https://github.com/unslothai/unsloth/pull/5301)**

| | |
|---|---|
| **Author** | @LeoBorcherding |
| **Status** | ✅ merged |
| **Opened** | 2026-05-06 |
| **Repo importance** | ★65,854 · 5,886 forks · score 94,397 |
| **Diff** | +4274 / −201 across 21 files |
| **Engagement** | 83 conversation · 31 inline review comments |

## Top review comments (ranked by reactions)

### @jgreenburg — 1 reactions  
`😄 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5301#issuecomment-4399181959)

> I can confirm this is working correctly on my system equipped with an igpu and discrete Radeon AI PRO R9700.
> Here is the summary of the hardware it's running on along with the install log succeeding to detect my hardware correctly and inference is working as expected.
> ```
> [user@System unsloth]$ fastfetch -l none
> -------------
> OS: CachyOS x86_64
> Host: MotherBoard Series (1.0)
> Kernel: Linux 7.0.3-1-cachyos
> Uptime: 1 day, 23 hours, 20 mins
> Packages: 1895 (pacman)
> Shell: bash 5.3.9
> Terminal: /dev/pts/0
> CPU: AMD Ryzen 9 7945HX3D (32) @ 5.46 GHz
> GPU: AMD Radeon AI PRO R9700 [Discrete]
> Memory: 2.84 GiB / 93.99 GiB (3%)
> Swap: 265.86 MiB / 93.99 GiB (0%)
> Disk (/): 1.70 TiB / 1.82 TiB (93%) - btrfs
> Local IP (enp7s0): 10.0.0.47/27
> Locale: en_US.UTF-8
> 
> [user@System unsloth]$ amd-smi
> +------------------------------------------------------------------------------+
> | AMD-SMI 26.2.2+unknown       amdgpu version: Linuxver ROCm version: 7.2.2    |
> | VBIOS version: 00158738                                                      |
> | Platform: Linux Baremetal                                                    |
> |-------------------------------------+----------------------------------------|
> | BDF                        GPU-Name | Mem-Uti   Temp   UEC       Power-Usage |
> | GPU  HIP-ID  OAM-ID  Partition-Mode | GFX-Uti    Fan               Mem-Usage |
> |=====================================+========================================|
> | 0000:03:00.0 ...Radeon AI PRO R9700 | 0 %      34 °C   0            17/300 W |
> |   0       0     N/A             N/A | 0 %     20.0 %             57/32624 MB |
> +------- … *[truncated]*

### @Chigoma333 — 1 reactions  
`👍 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5301#issuecomment-4410095678)

> **Tested on Strix Halo (AMD Radeon 8060S, 128GB unified memory)**
> **BEFORE THIS FIX**
> The installer defaulted to PyTorch ROCm 7.1 instead of using my system’s ROCm 7.2 setup. Even after manually switching this same system to ROCm 7.1 for testing, training still failed at the exact same point:
> 
> ./install.sh --local --verbose
> 
> It installed:
> - torch==2.10.0+rocm7.1
> - torchaudio==2.11.0+rocm7.1
> - torchvision==0.25.0+rocm7.1
> 
> Training would then fail after:
> 🦥 Unsloth: Will patch your computer to enable 2x faster free finetuning.
> 
> After that, the gui would show "Training process exited unexpectedly"
> 
> It also incorrectly detected available memory and showed this warning even though I have 128GB unified memory:
> 
> Could not load config for 'unsloth/Qwen3.5-2B':
> The checkpoint you are trying to load has model type `qwen3_5`
> but Transformers does not recognize this architecture.
> 
> Falling back to all visible GPUs -- model may not fit
> selected_gpu_ids: [0]
> usable_gb: 0.35
> required_gb: 6.123
> 
> ```
> ./install.sh --local --verbose
> 
>   🦥 Unsloth Studio Installer
>   ────────────────────────────────────────────────────
> 
>   platform       linux
>   deps           all system dependencies found
>   venv           creating Python 3.13 virtual environment
>                  /home/chigoma333/.unsloth/studio/unsloth_studio
> Using CPython 3.13.13
> Creating virtual environment at: /home/chigoma333/.unsloth/studio/unsloth_studio
> Activate with: source /home/chigoma333/.unsloth/studio/unsloth_studio/bin/activate.fish
>   venv           using environment
>                  /home/chigoma333/.unsloth/studio/unsloth_studio … *[truncated]*

### @h34v3nzc0dex — 1 reactions  
`👍 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5301#issuecomment-4468384104)

> Confirmed `bbf004c` lands clean on real `gfx1151` hardware here:
> 
> - **Issue 1 override fires correctly.** Simulated the new `case "$TORCH_INDEX_URL"` branch — `rocminfo` detects `gfx1151`, `TORCH_INDEX_URL` flips `…/rocm7.1` → `…/rocm7.2`, `TORCH_CONSTRAINT` updates to `torch>=2.11.0,<2.12.0`, `_amd_gpu_radeon=false`. (The new unit tests use mocked input; this confirms the script fires on actual Strix Halo / `amd-smi`.)
> - **Issue 2 gcc-loop** picks `/usr/lib/gcc/x86_64-linux-gnu/13` on Ubuntu 24.04 here (gcc-14 runtime dir exists but no `/usr/include/c++/14`, so loop falls through to 13). Matches the dir my Phase 3 patch landed on for the clean 417/417 llama.cpp build.
> 
> ## Independent verification of the upstream-AMD claim
> 
> `b33a90e`'s commit message asserts *"AMD fixed the gfx1200 null HIP kernel in ROCm 7.13 (torch 2.11+)"*. To check the same holds for **gfx1151** (since `bbf004c`'s `[WARN]` text and `moe_utils.py:167` framing live or die on that claim), I ran a surgical probe of `unsloth_zoo.temporary_patches.moe_utils._check_torch_grouped_mm_supported()` against `torch==2.11.0+rocm7.13.0` (HIP 7.13.26176) on this same box:
> 
> ```
> torch:           2.11.0+rocm7.13.0a20260506
> torch.version.hip: 7.13.26176
> device 0:        Radeon 8060S Graphics (gfx1151)
> hasattr _grouped_mm: True
> unsloth_zoo:     2026.5.1 (PyPI latest)
> 
> DIRECT PROBE SUCCESS: out.shape=(1, 8) dtype=torch.float16
> DIRECT PROBE VALUE: [8.0, 8.0, 8.0, 8.0]
> 
> FUNCTION RESULT: True   ← _check_torch_grouped_mm_supported()
> ```
> 
> - No SIGSEGV, no exception
> - `faulthandler.enable()` set pre-import; subprocess-isolated, so … *[truncated]*

### @LeoBorcherding — 1 reactions  
`🎉 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5301#issuecomment-4468553059)

> ## Summary
> 
> Full AMD ROCm support for Windows and targeted Linux fixes for Strix Halo / Ubuntu 24.04. 14 files changed, ~2600 lines added.
> 
> ---
> 
> ## Windows: AMD GPU detection (install.ps1, setup.ps1)
> 
> Both scripts now detect AMD GPUs on Windows with the same reliability as Linux:
> 
> - **Full detection waterfall**: `hipinfo` (PATH) → `hipinfo` (HIP_PATH\bin / ROCM_PATH\bin) → `amd-smi` → WMI name-based fallback. The AMD HIP SDK sets `HIP_PATH` / `ROCM_PATH` but doesn't always add the bin dir to PATH — the env-var fallback handles this silently.
> - **Three-way message branching**:
>   - HIP SDK installed + device accessible → normal ROCm path
>   - HIP SDK installed + device **not** ROCm-accessible → "AMD GPU detected -- not ROCm-accessible (HIP 7.1.xxx)" with explanation that it's a driver issue, not an SDK issue
>   - HIP SDK not installed → "AMD GPU detected -- HIP SDK not found" with install link
> - **Terminal visibility**: HIP SDK path and full `hipconfig --version` string shown as substeps under the `gpu` step on successful detection.
> - **Python 3.12 preference**: AMD ROCm users are steered toward Python 3.12 (3.13 wheels are not yet available from AMD's index) with venv recreation if needed.
> - **GPU detected before Python selection** to avoid creating a 3.13 venv that immediately needs to be recreated.
> 
> ---
> 
> ## Windows: AMD ROCm PyTorch wheel installation (install.ps1, install_python_stack.py)
> 
> - **Arch-aware wheel index**: maps detected gfx arch → AMD's pip index at `https://repo.amd.com/rocm/whl/{arch_family}/`. Supported: gfx1200/gfx1201 (RDNA 4), gfx1100 (RDNA 3), gfx1102, g … *[truncated]*

### @danielhanchen — 1 reactions  
`👍 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5301#issuecomment-4485637374)

> Pushed `0c2020d5` to your branch covering five edge cases I ran into while reviewing. Quick summary:
> 
> **`studio/backend/main.py`**
> - `BNB_ROCM_VERSION` was set whenever `HIP_PATH` or `ROCM_PATH` was present. A Windows CUDA user who once installed the HIP SDK and reverted still has those env vars set, so `bitsandbytes` would try to load `libbitsandbytes_rocm72.dll` against a CUDA torch. Now probe `torch.version.hip` inside the guard. `worker.py` already does it this way.
> - `os.add_dll_directory` returned handles were dropped. Per CPython docs the directory leaves the search list when the handle is GC'd. Stored in module-level `_ROCM_DLL_HANDLES`.
> 
> **`studio/install_python_stack.py`**
> - `_install_bnb_windows_rocm()` returned `None` regardless of `pip_install_try` outcome, and the caller set `_rocm_windows_torch_installed = True` unconditionally. On a failed BNB install the post-install warning was suppressed. Helper now returns `bool`; caller gates on it.
> - `_detect_windows_gfx_arch` returned the raw capture group, so mixed-case hipinfo output (`Gfx1151`) missed the lowercase keys in `_GFX_TO_AMD_INDEX_ARCH` and silently fell back to CPU torch. Lowercased.
> - `UNSLOTH_ROCM_TORCH_INSTALLED=1` early-return trusted the env var even when the venv was wiped between runs. Subprocess-probe torch importability first; fall through otherwise.
> 
> **Tests**
> - All 230 prior tests still pass, plus 1 new test for the early-return fall-through case.
> - Two existing `TestRocmTorchInstalledEnvVar` tests now patch the torch subprocess probe (single-line change each).
> 
> Have a look when you get a cha … *[truncated]*

### @LeoBorcherding — 1 reactions  
`👀 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5301#issuecomment-4492319148)

> ## OOM guard: prevent system freeze on VRAM exhaustion (ROCm/RDNA 4)
> 
> **Problem**
> 
> Running a QLoRA training session on an RX 9060 XT (gfx1201, RDNA 4) with a 
> long-sequence dataset (OpenMathReasoning) caused the machine to hard-freeze 
> completely unresponsive, required a forced power-off.
> 
> The root cause is a ROCm/HIP driver behaviour on newer RDNA 4 hardware: when 
> VRAM is fully exhausted the HIP driver hangs the GPU ring buffer instead of 
> propagating a recoverable Python exception. Once the ring buffer stalls, all 
> kernel-mode GPU calls block indefinitely, the display stack freezes with it, 
> and the only recovery is a hard reboot. There is no graceful OOM path at the 
> driver level on gfx1200/gfx1201 yet.
> 
> **Fix**
> 
> Two-part change in `run_training_process` (section 1g):
> 
> 1. **Proactive allocator cap**: `torch.cuda.set_per_process_memory_fraction(0.90)` 
>    tells the HIP/CUDA allocator to raise `OutOfMemoryError` at 90% of available 
>    VRAM. PyTorch stops the allocation before the driver hits the hardware wall, 
>    keeping the driver alive and the system fully responsive.
> 
> 2. **Actionable UI error**: the top-level exception handler now detects OOM 
>    errors (by type name and message content across both CUDA and HIP) and 
>    surfaces a clear, human-readable message to the Studio UI with concrete steps 
>    to resolve it, instead of the raw CUDA/HIP error string.
> 
> ```python
>     # ── 1g. ROCm/CUDA OOM guard ──
>     # On RDNA 4 (gfx1200/gfx1201) and other ROCm GPUs, exhausting VRAM can
>     # cause a HIP driver hang that freezes the entire system rather than
>     # raising a Pyt … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
