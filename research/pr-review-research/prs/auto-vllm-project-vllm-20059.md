# vllm-project/vllm #20059 — [Core] Allow full cudagraph with separate attention routines and orthogonal to compilation, add support for FA2 and FlashInfer

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/20059)**

| | |
|---|---|
| **Author** | @fhl2000 |
| **Status** | ✅ merged |
| **Opened** | 2025-06-25 |
| **Repo importance** | ★81,996 · 17,677 forks · score 157,703 |
| **Diff** | +1840 / −598 across 34 files |
| **Engagement** | 79 conversation · 310 inline review comments |

## Top review comments (ranked by reactions)

### @ProExpertProg — 4 reactions  
`👍 2 · 🎉 2`  ·  [link](https://github.com/vllm-project/vllm/pull/20059#issuecomment-3086829014)

> Hey, sorry for the late response here. Lucas, Sage, and I discussed this at length yesterday and settled on an extension of the last proposal I made in a comment above. I then spent some more time thinking about the implementation and came up with this flowchart representing the code structure. I included it below as well as added some more context around it. Please let me know if you have any questions, and if you need any help. Also feel free to reuse any part of this comment in code comments or the PR description. We can also adapt it and add it documentation.
> 
> ### Motivation
> 
> The reason for another adjustment is this proposal from Lucas:
> > Honestly I find all these flags very confusing; I think I much simpler more extensible dispatch logic would be:
> 
> > ```
> > dispatch_key = DispatchKey(num_reqs=..., num_tokens=..., uniform_batch=...)
> > if dispatch_key in self.full_cudagraphs:
> >      return self.full_cudagraphs[dispatch_key]
> > # Fall-back if a full_cudagraph isn't available 
> > return self.piecewise_cudagraph or self.model
> > ```
> 
> I agree that dispatching between multiple `CUDAGraphWrapper` instances just for those instances to do more lookups and dispatching is not ideal. 
> 
> ### Proposal
> My proposal is to pull dispatching fully out of `CUDAGraphWrapper` instances and make the `CUDAGraphDispatcher` fully responsible for it. This way the dispatcher is the single source of truth for available `CUDAGraph`s. It communicates with the wrappers via the forward context, and the wrappers’ logic is further simplified, as they only need to handle passthrough, collection and replay, wit … *[truncated]*

### @fhl2000 — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/vllm-project/vllm/pull/20059#issuecomment-3160858458)

> ### Benchmark serving of the latest refactors.
> 
> Here are some results after modifying cudagraph_mode to include `NONE`, `PIECEWISE`, `FULL`, `FULL_DECODE_ONLY`, and `FULL_AND_PIECEWISE`.    The CLI is now like adding `--compilation-config '{"cudagraph_mode":"FULL"}'`.
> 
> Note1: `FULL` mode basically only captures cudagraph for non-uniform batches, and treats the uniform-batches the same as non-uniform batches for cudagraph replaying. 
> 
> Note2: `FULL` mode for attention backends which support cudagraph of pure-decode-only(FlashInfer) or uniform batch only (FlashMLA) would be translated into `FULL_AND_PIECEWISE` (if piecewise compilation) or `FULL_DECODE_ONLY` (if no piecewise compilation). 
> `FULL` mode is desired for FA3 backend, which supports cudagraph with unified kernel (also AOT scheduling). For attention backends like FA2 and Triton_attn, `FULL_DECODE_ONLY` and `FULL_AND_PIECEWISE` are more recommended.
> 
> Benchmark command:
> >python vllm/benchmarks/benchmark_serving.py --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 --dataset-name sharegpt --dataset-path ShareGPT_V3_unfiltered_cleaned_split.json --num-prompts 50 --request-rate 10
> 
> env: A100 40G, torch2.6, cuda12.4
> 
> ### Flash attention v2 (-O3)
> (a). piecewise on main branch
> (b). PIECEWISE mode
> (c). FULL mode (capturing non-uniform batch only)
> (d). FULL_DECODE_ONLY mode 
> (e). FULL_AND_PIECEWISE mode
> 
> |Metric \Source|	(a)	| (b) |  (c) | (d)	| (e) |
> |----------------|-----|---|---|---|---|
> Benchmark duration (s)| 9.04 | 8.90 | 8.75| 8.36| 8.32 |
> Request throughput (req/s) | 5.53 | 5.62  | 5.71|  5.98| 6.01 |
> Output token throughput … *[truncated]*

### @yinghai — 3 reactions  
`👍 3`  ·  [link](https://github.com/vllm-project/vllm/pull/20059#issuecomment-3092447665)

> > My proposal is to pull dispatching fully out of CUDAGraphWrapper instances and make the CUDAGraphDispatcher fully responsible for it.
> 
> Cool this makes a lot of sense to me. Like the dispatcher managers the graph managers but the graph managers can be of different type (full, piecewise with torch.compile).

### @minosfuture — 3 reactions  
`👍 3`  ·  [link](https://github.com/vllm-project/vllm/pull/20059#issuecomment-3109599259)

> @fhl2000 Thanks for the great work!
> I tested this with Maverick and hit the following error.  The same command works well on main.
> 
> ```
> vllm serve meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8 \
>   --max_model_len 8192 --kv_cache_dtype fp8 --enable-expert-parallel \
>   --tensor-parallel-size 8 --trust-remote-code --gpu-memory-utilization 0.8 \
>   --disable-log-requests --compilation-config '{"full_cuda_graph":true}'
> ```
> 
> ```
> (VllmWorker rank=0 pid=1386048) ERROR 07-23 10:22:47 [multiproc_executor.py:546]   File "/data/users/yming/gitrepos/vllm/vllm/compilation/cuda_graph.py", line 114, in _call_
> (VllmWorker rank=0 pid=1386048) ERROR 07-23 10:22:47 [multiproc_executor.py:546]     validate_cudagraph_capturing_enabled()
> (VllmWorker rank=0 pid=1386048) ERROR 07-23 10:22:47 [multiproc_executor.py:546]   File "/data/users/yming/gitrepos/vllm/vllm/compilation/monitor.py", line 51, in validate_cudagraph_capturing_enabled
> (VllmWorker rank=0 pid=1386048) ERROR 07-23 10:22:47 [multiproc_executor.py:546]     raise ValueError("CUDA graph capturing detected at an inappropriate "
> (VllmWorker rank=0 pid=1386048) ERROR 07-23 10:22:47 [multiproc_executor.py:546] ValueError: CUDA graph capturing detected at an inappropriate time. This operation is currently disabled.
> (VllmWorker rank=0 pid=1386048) ERROR 07-23 10:22:47 [multiproc_executor.py:546]
> ```

### @fhl2000 — 2 reactions  
`👍 2`  ·  [link](https://github.com/vllm-project/vllm/pull/20059#issuecomment-3039446627)

> @ProExpertProg  Just had deeply re-architected it to fully decouple cudagraph logic from compilation, referring to what we had discussed previously.  Below are summaries of major changes:
> 1. Add the `CUDAGraphMode` and `CUDAGraphRuntimeStyle` enums.  The former is currently used inside the compilation_configs, and the latter is for dispatching between sets of cudagraphs at runtime.  They have the same constant type of `NONE`, `PIECEWISE`, and `FULL`.  Currently, CUDAGraphMode is regarded as having three different levels. NONE for no cudagraph,  PIECEWISE for only piecewise cudagraph, and FULL for the maximum full cudagraph support (may fall back to piecewise cudagraph or no cudagraph if necessary).
> 2. We now have a `CUDAGraphWrapper` class that can wrap any runnable even without compilation.  The compilation logic is still inside the piecewise backend (platform-independent), while `CUDAGraphWrapper` (platform-specific)  can be initialized inside the piecewise backend or outside the compilation (in the gpu model runner) independently. One `CUDAGraphWrapper` instance can only react to one specific `CUDAGraphRuntimeStyle` it has been assigned. 
> 3. For forward_context, use `num_tokens` for runtime shape inferring, and also use `CUDAGraphRuntimeStyle` as a context. The `is_pure_decode` flag is now removed from forward_context, and it is only used for a new  `cudagraph_dispatch` context manager inside the gpu model runner.
> 4. For `AttentionMetadataBuilder`, use enum class `AttentionCGSupport` with `ALWAYS`, `PURE_DECODE_ONLY` and `NEVER` to cover the three cases you mentioned, an … *[truncated]*

### @minosfuture — 2 reactions  
`👍 2`  ·  [link](https://github.com/vllm-project/vllm/pull/20059#issuecomment-3112110512)

> > @minosfuture I've pushed a new commit to fix it. Would you mind trying it again? My mistake at not fully considering the scenario for FA3, whose attention_cg_support is ALWAYS_UNIFIED. In this case, we capture only one set of full cudagraph, and the `is_uniform` flag should consistently be treated as False.
> 
> tested and verified. Thanks for the fix!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
