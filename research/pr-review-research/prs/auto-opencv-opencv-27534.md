# opencv/opencv #27534 — GSoC 2025: Add Tokenizer Support to DNN Module

**[View PR on GitHub](https://github.com/opencv/opencv/pull/27534)**

| | |
|---|---|
| **Author** | @JorgeV92 |
| **Status** | ✅ merged |
| **Opened** | 2025-07-12 |
| **Repo importance** | ★87,790 · 56,575 forks · score 319,089 |
| **Diff** | +8867 / −58 across 14 files |
| **Engagement** | 26 conversation · 101 inline review comments |

## Top review comments (ranked by reactions)

### @abhishek-gola — 3 reactions  
`👍 3`  ·  [link](https://github.com/opencv/opencv/pull/27534#issuecomment-4162673333)

> @asmorkalov @nklskyoy, The sample works perfectly fine for me.
> 
> with ENGINE_NEW;
> ```
> OPENCV_FORCE_DNN_ENGINE=2 python gpt2_inference.py --model=gpt2.onnx --prompt="What is OpenCV?" --tokenizer_path=./gpt2/config.json
> Preparing GPT-2 model...
> [ WARN:0@0.404] global onnx_importer2.cpp:1509 parseGather DNN/ONNX: Gather node 'node_embedding' axis=0, outputs=embedding
> [ WARN:0@0.404] global onnx_importer2.cpp:1509 parseGather DNN/ONNX: Gather node 'node_embedding_1' axis=0, outputs=embedding_1
> Inferencing GPT-2 model...
> What is OpenCV?
> 
> OpenCV is a programming language that allows you to write programs that run on a computer. It is a programming language that allows you to write programs that
> ```
> 
> with ENGINE_ORT:
> ```
> OPENCV_FORCE_DNN_ENGINE=4 python gpt2_inference.py --model=gpt2.onnx --prompt="What is OpenCV?" --tokenizer_path=./gpt2/config.json
> Preparing GPT-2 model...
> Inferencing GPT-2 model...
> What is OpenCV?
> 
> OpenCV is a programming language that allows you to write programs that run on a computer. It is a programming language that allows you to write programs that
> ```

### @fengyuentau — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/opencv/opencv/pull/27534#issuecomment-3289658545)

> @JorgeV92 I did some code cleanup and added a new test in Python testing our json parser against the Python's json lib on vocab. Currently it passes. Could you add it to this PR? I attached the patch below and you can apply it in this way:
> 
> ```bash
> # Save the patch (attached below) in your development directory (./opencv) and name it 1.patch, for example.
> git am < 1.patch
> git push
> ```
> 
> Below is the patch.
> 
> <details>
> 
> ```.patch
> From 617890c08869404f0ca39f18c14e6e84ff957506 Mon Sep 17 00:00:00 2001
> From: Yuantao Feng <yuantao.feng@outlook.com>
> Date: Sun, 14 Sep 2025 15:14:24 +0800
> Subject: [PATCH] feat: code cleanup on json parser; add a new test to test
>  against python json on vocab
> 
> ---
>  modules/core/src/persistence_json.cpp   | 12 -------
>  modules/core/test/test_io.cpp           |  9 +++--
>  modules/python/test/test_json_parser.py | 45 +++++++++++++++++++++++++
>  3 files changed, 51 insertions(+), 15 deletions(-)
>  create mode 100644 modules/python/test/test_json_parser.py
> 
> diff --git a/modules/core/src/persistence_json.cpp b/modules/core/src/persistence_json.cpp
> index c745bd4950..f491234051 100644
> --- a/modules/core/src/persistence_json.cpp
> +++ b/modules/core/src/persistence_json.cpp
> @@ -421,23 +421,11 @@ public:
>          char * beg = ptr + 1;
>          std::string key_name;
>          do {
> -            // if (*ptr == '\\') { // skip the next character if current is back slash
> -            //     ++ptr;
> -            //     CV_PERSISTENCE_CHECK_END_OF_BUFFER_BUG_CPP();
> -            //     key_name += *ptr;
> -            //     ++ptr;
> -            //     CV_PERSISTENCE_CHECK_END_O … *[truncated]*

### @fengyuentau — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/27534#issuecomment-3138901369)

> @JorgeV92 Please rebase your branch to have new FileStorage with required fixes.
> 
> ```
> git remote add upstream https://github.com/opencv/opencv
> git fetch upstream
> # make sure your worktree is clean, i.e. no changes
> git rebase upstream/5.x
> git push -f
> ```

### @asmorkalov — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/27534#issuecomment-3167400407)

> Small additions to the proposed interface for proper bindings generation:
> ```
> class CV_EXPORTS_W Tokenizer: {
> public:
>   CV_WRAP static Tokenizer load(CV_WRAP_FILE_PATH const std:string &pretrained_model_path);
>   CV_WRAP std::vector<int> encode(const std::string &text);
>   CV_WRAP std::string decode(const std::vector<int> &tokens);
> };
> ```

### @fengyuentau — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/27534#issuecomment-3263847806)

> There are some failing tests in different hosts. Please also take a look.

### @fengyuentau — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/27534#issuecomment-3280326512)

> 1. trailing whitespaces. `git diff --check`.
> 2. warnings at the building stage. it relates to the regex library (stl).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
