# protocolbuffers/protobuf #23547 — Add gencode smoke tests

**[View PR on GitHub](https://github.com/protocolbuffers/protobuf/pull/23547)**

| | |
|---|---|
| **Author** | @esrauchg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zhangskz
> Could we have protobuf-team-bot handle this? I imagine we could configure branches in yml and a GHA that calls this script to check in jars + BUILD file

### @zhangskz
> if we wanted to be comprehensive about our coverage of minor release, perhaps we could have the script check if the outputted gencode is actually unique and skip minor versions

### @mkruskal-google
> Do we need to check in the gencode at all? We could have GHA invoke this script on the fly

### @esrauchg
> I think I like the characteristics of checking in the gencode for this specific test: mainly that it you can have a local checkout and make a proposed edit and run `bazel test`

### @esrauchg
> if we _do_ want to check in for every single minor release, it makes sense that either the bot handle it...or just add a final number to the releaser script

### @zhangskz
> checked in gencode does mimic the user case we're trying to test anyways, so I think either is fine...Esp if we invoke on-the-fly we should probably include some sort of sha check

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
