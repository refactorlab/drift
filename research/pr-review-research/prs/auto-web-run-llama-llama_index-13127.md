# run-llama/llama_index #13127 — SecGPT - LlamaIndex Integration

**[View PR on GitHub](https://github.com/run-llama/llama_index/pull/13127)**

| | |
|---|---|
| **Author** | @Yuhao-W |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nerdai
> Could you follow the instructions at the link provided to get in the standard format? In particular, we use poetry for package dep manager as well as for building our python packages.

### @nerdai
> Since there is a prompt here, I think we should subclass `PromptMixin`

### @nerdai
> This may be a bit of a name clash with llama-index ecosystem. As this is not really a `QueryEngine` but rather a `QueryPipeline`.

### @nerdai
> I do think your pack would greatly improve if you were able to include some doc/class strings throughout your code (i.e., quick descriptions of funcs/classes and its params/args).

### @nerdai
> This looks like it was used perhaps for testing while developing? I would suggest converting this into an actual unit test and using mocking of LLMs.

### @nerdai
> Can we have a small fully functional example of SecGPT working? I think the notebooks are only for illustrations (simulations) and we don't really have any unit tests.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
