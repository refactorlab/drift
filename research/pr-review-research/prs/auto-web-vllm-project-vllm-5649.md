# vllm-project/vllm #5649 — [Feature] OpenAI-Compatible Tools API + Streaming for Hermes & Mistral models

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/5649)**

| | |
|---|---|
| **Author** | @K-Mistele |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @interstellarninja
> there's a slight issue with this tool call -- our format requires new lines after <tool_call> XML tags

### @aw632
> Given that guided decoding is not enabled for 'auto' tool use, what is the error handling planned in case the LLM does not output valid JSON?

### @K-Mistele
> each model that supports tool calling uses its own format for function calls...the response format is up to the model and its trainer

### @K-Mistele
> I propose creating a ToolCallParser abstract class that can be implemented for different models like mistral and hermes

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
