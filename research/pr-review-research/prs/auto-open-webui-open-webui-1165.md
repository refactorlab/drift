# open-webui/open-webui #1165 — refac: Dockerfile

**[View PR on GitHub](https://github.com/open-webui/open-webui/pull/1165)**

| | |
|---|---|
| **Author** | @jannikstdl |
| **Status** | ✅ merged |
| **Opened** | 2024-03-14 |
| **Repo importance** | ★140,116 · 20,118 forks · score 225,578 |
| **Diff** | +216 / −94 across 7 files |
| **Engagement** | 81 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @ghost — 3 reactions  
`👍 3`  ·  [link](https://github.com/open-webui/open-webui/pull/1165#issuecomment-2028548557)

> This is fantastic, thanks!  I can confirm that CUDA is working with Podman on Arch Linux after a few fixes submitted as jannikstdl/open-webui#2. Once this is merged with main, we should probably switch the `print()` with `log.debug()`. Here's the process I used and the trouble I experienced:
> 
> #### Build ####
> ```bash
> podman build -t openwebui_cuda --build-arg="USE_CUDA=true" .
> ```
> 
> #### Testing ####
> ```bash
> podman run --gpus all -p 127.0.0.1:3333:8080 --network slirp4netns:allow_host_loopback=true --add-host=ollama.local:10.0.2.2 --env 'OLLAMA_BASE_URL=http://ollama.local:11434' -v openwebui_cuda:/app/backend/data --name openwebui_cuda --replace openwebui_cuda
> ```
> 
> To validate that whisper uses my GPU, I used `nvidia-smi`:
> 
> ```
> $ UVICORN_PID=$(pidof /usr/local/bin/python); date; echo; ps -o command -p $UVICORN_PID; echo; while true; do nvidia-smi --query-accounted-apps=timestamp,gpu_name,pid,gpu_utilization --format=csv,noheader|grep $UVICORN_PID; sleep 0.5; done
> Sat Mar 30 08:52:35 PM MDT 2024
> 
> COMMAND
> /usr/local/bin/python /usr/local/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --forwarded-allow-ips *
> 
> 2024/03/30 20:52:36.018, NVIDIA GeForce RTX 4090 Laptop GPU, 107583, 0 %
> <SNIP>
> 2024/03/30 20:52:43.280, NVIDIA GeForce RTX 4090 Laptop GPU, 107583, 2 %
> 2024/03/30 20:52:43.802, NVIDIA GeForce RTX 4090 Laptop GPU, 107583, 2 %
> 2024/03/30 20:52:44.326, NVIDIA GeForce RTX 4090 Laptop GPU, 107583, 3 %
> 2024/03/30 20:52:44.851, NVIDIA GeForce RTX 4090 Laptop GPU, 107583, 3 %
> 2024/03/30 20:52:45.374, NVIDIA GeForce RTX 4090 Laptop GPU, 107583, 3 %
> ```
> 
> #### Problems ####
> 
> 1. `wh … *[truncated]*

### @jannikstdl — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/open-webui/open-webui/pull/1165#issuecomment-2034114533)

> @justinh-rahb Ready for review!
> 
> You should not be able to use these build ARGS:
> 
> e.g.
>   ```bash
>   --build-arg="USE_EMBEDDING_MODEL=intfloat/multilingual-e5-large"
>   ```
> 
>   For "intfloat/multilingual-e5-large" custom embedding model (default is all-MiniLM-L6-v2), only works with [sentence transforer models](https://huggingface.co/models?library=sentence-transformers). Current [Leaderbord](https://huggingface.co/spaces/mteb/leaderboard) of embedding models.
> 
>   ```bash
>   --build-arg="USE_OLLAMA=true"
>   ```
>   For including ollama in the image.
> 
>   ```bash
>   --build-arg="USE_CUDA=true"
>   ```
>   To use CUDA exeleration for the embedding and whisper models.
> 
>   > [!NOTE]
>   > You need to install the [Nvidia CUDA container toolkit](https://docs.nvidia.com/dgx/nvidia-container-runtime-upgrade/) on your machine to be able to set CUDA as the Docker engine. Only works with Linux - use WSL for Windows!
> 
>   ```bash
>   --build-arg="USE_CUDA_VER=cu117"
>   ```
>   For CUDA 11 (default is CUDA 12)
> 
> **Detailed description for usage in the conversation below, the README or the Dockerfile commentes**
> 
> @tjbck also should create 2 more openwebui images with the tag openwebui:with-ollama for included ollama or openwebui :cuda for cuda. As is said below i am not able to test this. This is the fastest way to get this versions running without the need to build the images for yourself.
> 
> Also the size of the raw image without any ARGs is lower and the Dockerfile is cleaner and better formatted now.
> 
> @yousecjoe @lainedfles Thank you for the effort! You helped to get this up and running!

### @justinh-rahb — 3 reactions  
`👍 2 · ❤️ 1`  ·  [link](https://github.com/open-webui/open-webui/pull/1165#issuecomment-2034322090)

> I've been testing with CUDA and the intfloat e5 large embed model since yesterday already, working great so far but will let you know after I try more stuff out.

### @justinh-rahb — 2 reactions  
`👍 2`  ·  [link](https://github.com/open-webui/open-webui/pull/1165#issuecomment-1997336997)

> @jannikstdl It builds on Mac, and RAG still works! 👌

### @jannikstdl — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/open-webui/open-webui/pull/1165#issuecomment-1997585142)

> > @jannikstdl It builds on Mac, and RAG still works! 👌
> 
> Thanks! Thats good news :D

### @jannikstdl — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/open-webui/open-webui/pull/1165#issuecomment-2002123796)

> I added @yousecjoe to this PR, he mentioned on Discord that he has some ides to optimize the Dockerfile for CUDA and other devices. 
> 
> Converted this to draft.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
