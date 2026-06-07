# AUTOMATIC1111/stable-diffusion-webui #14820 — Update to ROCm5.7 and PyTorch

**[View PR on GitHub](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/14820)**

| | |
|---|---|
| **Author** | @alexhegit |
| **Status** | ✅ merged |
| **Opened** | 2024-02-02 |
| **Repo importance** | ★163,453 · 30,371 forks · score 288,635 |
| **Diff** | +1 / −2 across 1 files |
| **Engagement** | 30 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @AUTOMATIC1111 — 3 reactions  
`👍 3`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/14820#issuecomment-1975224495)

> Will merge this into dev tomorrow if there are no objections.

### @Mantas-2155X — 1 reactions  
`👍 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/14820#issuecomment-1924209670)

> Been using 5.7 for weeks without any issues on AMD RX 7900 XT

### @chiragkrishna — 1 reactions  
`👍 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/14820#issuecomment-1953371431)

> i am using linux mint with 6750xt. pytorch always defaults to rocm5.4.2. is this way good for detecting amd gpus?
> 
> ```bash
> # Check if lspci command is available
> if ! command -v lspci &> /dev/null; then
>     echo "lspci command not found. Please make sure it is installed."
>     exit 1
> fi
> 
> # Use lspci to list PCI devices and grep for VGA compatible controller
> gpu_brand=$(lspci | grep "VGA compatible controller")
> # Check the GPU company
> if [[ $gpu_brand == *AMD* ]]; then
>     echo "AMD GPU detected."
>     
>     # Check if rocminfo is installed
>     if ! command -v rocminfo &> /dev/null; then
>         echo "Error: rocminfo is not installed. Please install ROCm and try again."
>         exit 1
>     fi
> 
>     # Get GPU information using rocminfo
>     rocm_info=$(rocminfo)
> 
>     # Extract GPU identifier (gfx part) from rocminfo output
>     gpu_info=$(echo "$rocm_info" | awk '/^Agent 2/,/^$/ {if ($1 == "Name:" && $2 ~ /^gfx/) {gsub("AMD", "", $2); print $2; exit}}')
> 
>     # Define officially supported GPU versions
>     supported_versions="gfx900 gfx906 gfx908 gfx90a gfx942 gfx1030 gfx1100"
>     # Check if the extracted gfx_version is in the list of supported versions
>     if echo "$supported_versions" | grep -qw "$gpu_info"; then
>         echo "AMD $gpu_info is officially supported by ROCm."
>         export TORCH_COMMAND="pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm5.7"
>     else
>         if [[ $gpu_info == gfx9* ]]; then
>             export HSA_OVERRIDE_GFX_VERSION=9.0.0
>             export TORCH_COMMAND="pip install torch==1.13.1+rocm5.2 torchvision==0.14.1+rocm5.2 --in … *[truncated]*

### @chiragkrishna — 1 reactions  
`👍 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/14820#issuecomment-1954468590)

> this way the rocm version can be chosen by the user
> 
> ```bash
> # Check if lspci command is available
> if ! command -v lspci &>/dev/null; then
>     echo "lspci command not found. Please make sure it is installed."
>     exit 1
> fi
> 
> # Use lspci to list PCI devices and grep for VGA compatible controller
> gpu_brand=$(lspci | grep "VGA compatible controller")
> # Check the GPU company
> if [[ $gpu_brand == *AMD* ]]; then
>     echo "AMD GPU detected."
> 
>     # Check if rocminfo is installed
>     if ! command -v rocminfo &>/dev/null; then
>         echo "Error: rocminfo is not installed. Please install ROCm and try again."
>         exit 1
>     fi
> 
>     # Get GPU information using rocminfo
>     rocm_info=$(rocminfo)
> 
>     # Extract GPU identifier (gfx part) from rocminfo output
>     gpu_info=$(echo "$rocm_info" | awk '/^Agent 2/,/^$/ {if ($1 == "Name:" && $2 ~ /^gfx/) {gsub("AMD", "", $2); print $2; exit}}')
>     # Define officially supported GPU versions
>     supported_versions="gfx900 gfx906 gfx908 gfx90a gfx942 gfx1030 gfx1100"
>     # Check if the extracted gfx_version is in the list of supported versions
>     if echo "$supported_versions" | grep -qw "$gpu_info"; then
>         echo "AMD $gpu_info is officially supported by ROCm."
>     else
>         echo "AMD $gpu_info is not officially supported by ROCm."
>         if [[ $gpu_info == gfx9* ]]; then
>             export HSA_OVERRIDE_GFX_VERSION=9.0.0
>             printf "\n%s\n" "${delimiter}"
>             printf "Experimental support gfx9 series: make sure to have at least 4GB of VRAM and 10GB of RAM or enable cpu mode: --use-cpu all --no-half"
>             printf " … *[truncated]*

### @Soulreaver90 — 1 reactions  
`👍 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/14820#issuecomment-1962328564)

> I think giving an option for AMD owners to choose between old stable ROCm or latest and greatest would be the best. And if latest and greatest doesnt work, a simple arg or setting can be used to revert back. All I know is that the latest versions work horribly for my 6700xt and not sure why. But the latest version is required for the newer gen cards. I'm indifferent, I can install whatever version, its just the non-tech folks that would potentially run into issues.

### @Soulreaver90 — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/14820#issuecomment-1925490486)

> I have a 6700 XT and updating to pytorch 2.1 + ROCm 5.7 (I think I tried 5.6 as well) causes my generations to perform slower and sometimes just lock up. I've just not had alot of success with anything beyond 2.0.1+ROCm 5.4.2, they work but just perform worse for me and my card. I recently rebuilt my machine from the ground up, tested it again and got fed up with it and downgraded.
> EDIT: Actually I had tested it on 2.1+ROCm 5.6, I didn't notice pytorch 2.2 was the latest so ill test when I get a chance to see if those performance issues were resolved.
> EDIT2: Tried it, not good. I can generate normal images with no issues. However once I use a larger size or hires.fix, it stutters like mad, takes forever to hire.res, and then my machine freezes until it says HIP out of memory and fails. I have no such issue at all with pytorch 2.0.1+ROCm 5.4.2, I even used the same exact generation and it performs fine.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
