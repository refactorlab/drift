# NVIDIA/NeMo #8743 — Open source export and deploy modules

**[View PR on GitHub](https://github.com/NVIDIA/NeMo/pull/8743)**

| | |
|---|---|
| **Author** | @oyilmaz-nvidia |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @titu1994
> The classname has insufficient context. Deploy Pytriton with which model? We are planning to deploy pytriton for streaming asr and tts too as new tools, so please call this class `DeployPytritonLLM`

### @titu1994
> Let's add these folders to ignore in setup.py, then the PR is ready to merge

### @JimmyZhang12
> We convert the nemo weights to TRTLLM format, and we have two functions to do this...the mapping of nemo names to TRTLLM names could be stored in some dict

### @JimmyZhang12
> could we use `tensorrt_llm.mpi_rank()` for self consistency?

### @ericharper
> will you follow up with a PR for developer docs? It will be helpful for nemo developers that want to use these new modules

### @ericharper
> Could you take a pass through the CodeQL, there's a lot of unused imports that need to be cleaned up

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
