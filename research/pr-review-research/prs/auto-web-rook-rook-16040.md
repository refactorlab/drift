# rook/rook #16040 — csi: automate CSI cephx key rotation

**[View PR on GitHub](https://github.com/rook/rook/pull/16040)**

| | |
|---|---|
| **Author** | @subhamkrai |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @BlaineEXE
> I much prefer strongly typed APIs. The map makes it opaque and easier to accidentally make backwards incompatible API changes in the future.

### @BlaineEXE
> IMO, the advantage is no risk of nil pointer exceptions. And I don't see an of issue with having empty structs.

### @travisn
> Will rgw status be on the cephcluster CR? I would expect it on the cephobjectstore.

### @travisn
> Strongly typed sounds good, as long as the rgw status doesn't show up in the cephcluster status

### @BlaineEXE
> This is getting pretty close I think. Especially because CSI is the most complicated rotation to implement (because of overlapping mode), I'm really relying on unit tests to explore all cases.

### @BlaineEXE
> IMO, yes. This is an example of why exhaustive unit testing of the low-level units is important.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
