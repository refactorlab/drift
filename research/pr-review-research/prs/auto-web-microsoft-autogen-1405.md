# microsoft/autogen #1405 — Code executors

**[View PR on GitHub](https://github.com/microsoft/autogen/pull/1405)**

| | |
|---|---|
| **Author** | @ekzhu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @afourney
> Given that we use the markdown header to specify language, should be allow executor to be a dictionary?

### @davorrunje
> Running in docker doesn't mean running in a separate docker container...running in the same docker container if autogen is already running in a docker container

### @IANTHEREAL
> Could you elaborate on the rationale behind assigning the execution capability to user_proxy and then extending this capability to the agent?

### @IANTHEREAL
> Injecting code executor information into the agent system via add_to_agent could potentially increase the complexity of tuning prompts

### @BeibinLi
> Keeping a TODO list for future: handle different types of system_message (not only str), handle DeprecationWarning throughout AutoGen, adding more detailed tutorials for Capabilities

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
