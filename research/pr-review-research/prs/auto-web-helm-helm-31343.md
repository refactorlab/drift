# helm/helm #31343 — chore: replace mitchellh/gox with goreleaser

**[View PR on GitHub](https://github.com/helm/helm/pull/31343)**

| | |
|---|---|
| **Author** | @TerryHowe |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @scottrigby
> should we configure gorelaser to keep the same file pattern we have now for checksums (including .asc sig info per checksum file), as opposed to a single file containing all checksums?

### @scottrigby
> we should make any needed changes in scripts/get-helm-4 in this same PR.

### @mattfarina
> Thanks for working on this. I tried to use it and ran into some issues. Can you please clean these up?

### @gjenkins8
> the LICENSE and README.md files are no longer in the same directory as the binary. But I think this is fine (and probably expected today)

### @benoittgt
> I'm wondering if the next step is to use GoReleaser to also publish artifacts on GitHub, so we have a backup when Azure experiences downtime

### @sabre1041
> With goreleaser now available, there are additional options that we can look to both deprecate some of the make targets as well as add new capabilities

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
