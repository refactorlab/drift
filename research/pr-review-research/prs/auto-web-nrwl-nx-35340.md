# nrwl/nx #35340 — feat(core): support filtered array-shape targetDefaults with projects and source

**[View PR on GitHub](https://github.com/nrwl/nx/pull/35340)**

| | |
|---|---|
| **Author** | @AgentEnder |
| **Status** | Merged (May 15, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @AgentEnder
> We should do this once, not per-target — flagging that targetDefaults normalization should occur at initialization rather than being repeatedly invoked for each target lookup.

### @AgentEnder
> These should have higher priority than the specified plugins since they'd overwrite the specified plugins entries long term — on specificity tier ordering for executor source-map attribution versus explicitly-specified plugin filters.

### @FrozenPandaz
> follow up.. we'll need to make sure that these generators will continue to work if people have made changes to their target defaults sometime in the timespan of Nx 23.x

### @AgentEnder
> No reason this should be here — marking code that infers project names from root paths as belonging outside the target-defaults module.

### @FrozenPandaz
> is this necessary? — questioning whether a particular parameter (`command`) was required in the matcher function signature.

### @AgentEnder
> Do we even still need this? — questioning whether legacy targetDefaults lookup code in the task runner remained necessary after graph construction changes.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
