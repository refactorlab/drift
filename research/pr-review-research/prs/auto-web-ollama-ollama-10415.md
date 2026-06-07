# ollama/ollama #10415 — tools: refactor tool call parsing and enable streaming

**[View PR on GitHub](https://github.com/ollama/ollama/pull/10415)**

| | |
|---|---|
| **Author** | @ParthSareen |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmorganca
> This seems fragile. Why are we checking these fixed characters vs: 1. Cut the prefix 2. Begin partial parsing of tool calls

### @benhaotang
> there seems to be no line breaks at all or very few line breaks streaming back from multiple qwen modes if I provide the tool list

### @benhaotang
> if I comment your modified tools.go from line 141 to 143...The line breaks are returned perfectly now. Maybe this replacement is done too broad (that should only be done for tool call section)?

### @ParthSareen
> It's for the case where a prefix has a `\n` in it...However I think I should be able to move this to just the prefix checking portion rather than globally in the parser

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
