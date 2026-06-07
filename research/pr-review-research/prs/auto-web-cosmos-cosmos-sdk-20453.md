# cosmos/cosmos-sdk #20453 — feat(store/v2): implement the feature to upgrade the store keys

**[View PR on GitHub](https://github.com/cosmos/cosmos-sdk/pull/20453)**

| | |
|---|---|
| **Author** | @cool-develope |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alpe
> Good start. I don't have the full picture but rename and delete seem to not be fully implemented, yet.

### @kocubinski
> I'm not sure about this API change.. `mountTreeFn MountTreeFn` in this constructor feels off from a DevEx perspective. Can it be defined internally in CommitStore?

### @kocubinski
> `storeOpts.SCType` appears to be the only value of importance bound within this closure when passed to `NewCommitStore`. If `mountTreeFn` is strictly required...

### @cool-develope
> the main problem is that the `Commitment` is an abstraction layer, and has no idea of how to construct the tree.

### @kocubinski
> Raised concern about storing only marker bytes for deleted keys — questioned whether this adequately captures deletion semantics across all database implementations.

### @tac0turtle
> Approved changes after code review, indicating the implementation satisfied core maintainer expectations.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
