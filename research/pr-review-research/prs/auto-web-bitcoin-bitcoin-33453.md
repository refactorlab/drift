# bitcoin/bitcoin #33453 — docs: Undeprecate datacarrier and datacarriersize configuration options

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/33453)**

| | |
|---|---|
| **Author** | @bitschmidty |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ajtowns
> I think we can actually make clear recommendations for when to use the datacarrier options: if you wish to avoid including large OP_RETURN outputs in blocks you mine, then reducing the datacarriersize will allow you to do that

### @jimmysong
> I don't think this PR goes far enough as the functionality of the datacarriersize argument is fundamentally different than what it was in v29. Multiple OP_RETURN outputs are still allowed by this change, creating a situation where users cannot get the same behavior

### @reardencode
> Adding, or in this case not removing, code with only negative effects on the actual operation of users' nodes is not responsible stewardship of bitcoin. Bowing to demands from people who do not understand what they are asking for is not how any successful project can operate.

### @darosior
> Optionality for the sake of it is counterproductive. On this basis, the `-datacarrier` and `-datacarriersize` options controlling a long obsolete relay policy limit are prime candidates for removal.

### @ryanofsky
> I see these options as basically the same as other options. Not particularly dangerous, not particularly interesting, likely to be kept if used and there are contributors willing to maintain them, and likely to be removed if not used.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
