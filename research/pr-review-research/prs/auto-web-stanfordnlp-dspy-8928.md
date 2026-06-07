# stanfordnlp/dspy #8928 — feat(gepa): add tool description optimization for multi-agent systems

**[View PR on GitHub](https://github.com/stanfordnlp/dspy/pull/8928)**

| | |
|---|---|
| **Author** | @Ju-usc |
| **Status** | Merged (Dec 5, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @LakshyAAAgrawal (foundational design question about tool-specific optimization)
> Tools now serve a different purpose: they help agents decide which tool to use. GEPA recognizes this categorical difference and applies a specialized reflection prompt.

### @chenmoneygithub (critical limitation regarding tool-use tracing)
> The implementation, especially how we extract tool trace from DSPy traces is a bit fragile...we are lacking this important lineage.

(Recommended pragmatically scoping the feature to ReAct modules only, deferring generic tool optimization until DSPy improves trace lineage capabilities.)

### @LakshyAAAgrawal (separation of concerns in the proposer architecture)
> Tools use ToolProposer, signatures use custom or parent default. Backward compatible.

### @chenmoneygithub (method complexity)
> This method is huge...creating a function on the fly. Separate propose_component_texts out to be a private method.

### @chenmoneygithub (log severity)
> This should be info instead warning unless we articulate that tool optimization works strictly better.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
