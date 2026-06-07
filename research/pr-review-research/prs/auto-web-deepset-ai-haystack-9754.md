# deepset-ai/haystack #9754 — feat: support structured outputs in `OpenAIChatGenerator`

**[View PR on GitHub](https://github.com/deepset-ai/haystack/pull/9754)**

| | |
|---|---|
| **Author** | @Amnah199 |
| **Status** | Merged (Sep 16, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @anakin87 (design concern about streaming compatibility)
> I would like to understand better. It seems that OpenAI supports streaming + structured outputs. If we are making this choice for simplicity reasons, I would be more specific: 'The OpenAIChatGenerator does not...'

(Prompted discussion about whether to block streaming with Pydantic models or allow it with schema-only formats.)

### @sjrl (dependency concern)
> Is there a different way to import this function that doesn't go through a private file? I'm a little worried the import path is subject to break/change

(Raised caution about using OpenAI's private `_pydantic.to_strict_json_schema` function; the author confirmed it was the only available approach.)

### @anakin87 (coverage gap)
> My impression is that several new code paths are not covered by unit tests. I would like to have them covered, since this component is crucial.

### @davidsbatista
Multiple technical reviews focused on docstring clarity, error handling, and Azure implementation alignment across multiple commits.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
