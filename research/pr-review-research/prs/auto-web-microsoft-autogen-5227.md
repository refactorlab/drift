# microsoft/autogen #5227 — Task-Centric Memory

**[View PR on GitHub](https://github.com/microsoft/autogen/pull/5227)**

| | |
|---|---|
| **Author** | @rickyloynd-microsoft |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jackgerrits
> This PR is simply too large. Please propose your changes progressively and iteratively using a separate sequence of PRs. We cannot effectively review these changes as is.

### @rickyloynd-microsoft
> I've moved the code under `autogen_ext/experimental/task_centric_memory` to convey the status and manage expectations as you suggested.

### @victordibia
> The teachability example is pretty cool, shows how the MemoryController can be used with the an AssistantAgent via the Memory interface.

### @rickyloynd-microsoft
> `agent = AssistantAgent(model_client=client, memory=[Teachability(MemoryController(False, client))])`

### @jackgerrits
> Discussed offline.

### @ekzhu
> As a next step #5542.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
