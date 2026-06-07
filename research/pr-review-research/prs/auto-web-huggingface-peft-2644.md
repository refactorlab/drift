# huggingface/peft #2644 — Add Arrow + GenKnowSub to LoRA

**[View PR on GitHub](https://github.com/huggingface/peft/pull/2644)**

| | |
|---|---|
| **Author** | @TheTahaaa |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> _Note: The reviewer (@githubnemo) discussion below is summarized from the public page; the page surfaced the substance of each review round but not always the fully verbatim sentence-by-sentence body. Quotes are paraphrase-summaries of @githubnemo's review comments._

### @githubnemo
> (July 21, 2025) Suggested implementing Arrow as its own method rather than a LoRA variant for better separation of concerns, but acknowledged code reuse benefits of the variant approach. Proposed a compromise: introduce an `ArrowConfig` class and a `create_arrow_model()` function for user-facing configuration and validation.

### @githubnemo
> (August 11, 2025) Raised concerns about prototype precomputation preventing adapter additions/removals and blocking fine-tuning scenarios. Suggested making prototype computation optional or implementing an `on_adapter_change()` method to handle dynamic adapter changes.

### @githubnemo
> (August 19, 2025) Identified rebase issues where changes from main were reverted and unrelated files had unwanted formatting. Requested cleanup to align with main branch and remove irrelevant auto-formatting changes.

### @githubnemo
> (August 21, 2025) Requested comprehensive documentation in the LoRA guide explaining Arrow's functionality, GKS enhancement, and adapter naming conventions. Also requested a standalone example showcasing Arrow/GKS performance benefits on benchmark datasets.

### @githubnemo
> (September 4, 2025) Noted the implementation was reaching maturity and requested moving `create_arrow_model()` to `arrow.py` for better organization, plus adding `ArrowConfig` to the package reference documentation for discoverability.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
