# Lightning-AI/pytorch-lightning #20775 — Fix double iteration bug when resumed from a checkpoint

**[View PR on GitHub](https://github.com/Lightning-AI/pytorch-lightning/pull/20775)**

| | |
|---|---|
| **Author** | @sudiptob2 |
| **Status** | Merged (August 5, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @deependujha
> all tests pass on macOS 14 with Python 3.12 and 2.7 in under 30 minutes, but the job still hangs until the 50‑minute timeout *(suspected multiprocessing queue handling problems)*

### @Copilot
> test_resume_training_with_checkpoint *(recommended this clearer test name instead of the incomplete `test_resume_training_with`)*

### @Borda
> Requested clarification on test file organization, suggesting improvements to test structure and naming conventions for better maintainability. *(paraphrased — verbatim text did not load)*

### @Borda
> Raised questions about the implementation approach in the training epoch loop, requesting explanation of design decisions around checkpoint-resumption tracking. *(paraphrased — verbatim text did not load)*

### @bhimrazy
> Questioned the approach to tracking resumption state, suggesting alternative methods that might be more robust and maintainable. *(paraphrased — verbatim text did not load)*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
