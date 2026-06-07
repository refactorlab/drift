# langchain-ai/langchain #20881 — [experimental][llms][OllamaFunctions] Add bind_tools and with_structured_output functions to OllamaFunctions

**[View PR on GitHub](https://github.com/langchain-ai/langchain/pull/20881)**

| | |
|---|---|
| **Author** | @lalanikarim |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Budlee
> You must always select one of the above tools and respond with only a JSON object matching the following schema

(Budlee flagged that this default prompt forces tool usage in loops, preventing conversational fallback responses when tools aren't needed.)

### @Budlee
> In the `_generate` function the convert_to_ollama_tool is not called...I'm not sure if this is by design?

### @lalanikarim
> newer PR #22339 addresses JSON serialization issues and tool conversion; default prompt designed as escape hatch for LLM fallback behavior when tools unnecessary

### @lalanikarim
> all of the examples around tool calling use LLMs like Claude or Gpt4...while llama3, phi3, and mistral are not that great in their current state.

### @leo-benkel
> LLM requesting tools repeatedly before responding, suggesting prompt engineering needed to "decide between using a tool or answering the user."

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
