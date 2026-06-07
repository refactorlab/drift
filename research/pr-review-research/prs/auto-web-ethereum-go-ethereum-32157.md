# ethereum/go-ethereum #32157 — internal/era: New EraE implementation

**[View PR on GitHub](https://github.com/ethereum/go-ethereum/pull/32157)**

| | |
|---|---|
| **Author** | @shazam8253 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lightclient
> Left a bunch of comments here - we still need to figure out how to call this module since `era2` isn't very elegant. In the meantime should rename `builder2.go` to just `builder.go` and `era2.go` to `era.go`.

### @lightclient
> `blockhash` and `blocknum` are already available via `header`, so no need to duplicate them

### @lightclient
> utilize proof interface more, avoid handling variant values directly [and] avoid building entire era file in memory, write incremental work to disk

### @MariusVanDerWijden
> Really no reason to ever abbreviate by taking out vowels in golang.

### @lightclient
> This is kind of impressive, but also is what an `Interface` is for...If you want different builders with the same methods...you can create the interface type and implement the method for both.

### @lightclient
> So on this method and ExportHistory we can avoid using this `Format` type by just passing in the functions we need...The issue with format is it is kind of a superfluous type.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
