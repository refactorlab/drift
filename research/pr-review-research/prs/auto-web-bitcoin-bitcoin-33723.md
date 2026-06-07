# bitcoin/bitcoin #33723 — chainparams: remove dnsseed.bitcoin.dashjr-list-of-p2p-nodes.us

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/33723)**

| | |
|---|---|
| **Author** | @SatsAndSports |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @achow101
> Given that Luke was hacked a couple years ago, arguably his DNS seed should have been removed at that time...it is still uncertain to me as to whether Luke has sole control of the seed.

### @pinheadmz
> We have a dns seed policy... any review of a PR like this MUST refer to the rules in this document.

### @gmaxwell
> This DNS seed is clearly violating policy— which was put into place to discourage abuse of seeds for attempting eclipse attacks and network surveillance.

### @polespinasa
> I have also queried the seeder a few times and didn't get a single v29 or v30 node...This violates point 1 [of policy].

### @john-moffett
> Provided detailed comparative table showing seed distribution: Luke's seeder returned zero v29/v30 nodes while other seeders returned many, demonstrating non-representative sampling.

### @glozow
> I think omitting Bitcoin Core v30 nodes definitely breaks this policy...based on the operator's behavior I assume it is intentional.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
