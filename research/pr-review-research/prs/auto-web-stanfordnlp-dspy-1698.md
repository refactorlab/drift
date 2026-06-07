# stanfordnlp/dspy #1698 — Dev finetune update

**[View PR on GitHub](https://github.com/stanfordnlp/dspy/pull/1698)**

| | |
|---|---|
| **Author** | @dilarasoylu |
| **Status** | Merged (Nov 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @okhat (design concern about adapter lifecycle)
> we may need to think about the role of adapter retries at (i) bootstrapping time and (ii) inference time with the FT'ed model.

### @chenmoneygithub (feature request for documentation)
> Can we create a notebook (Colab or other format) to demonstrate our use case from end to end?

### @chenmoneygithub (code style guidance)
> In general `assert` statement is discouraged...For this case, we can throw a ValueError.

### @chenmoneygithub (architectural question about data handling)
> Instead of having constructor take in adapters, and infer the data format from the adapter. Shall we set `data_format` in the constructor?

### @okhat (documentation requirement)
> We need a docstring that says why we inherit from Future, what are we trying to gain from that here

### @dilarasoylu (implementation clarification)
> It allow us to use the following methods to check on the training status of a job: `done()`, `result()` and `set_result()`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
