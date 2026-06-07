# istio/istio #51828 — V2 IP AutoAllocation Controller + Basic Ambient Support

**[View PR on GitHub](https://github.com/istio/istio/pull/51828)**

| | |
|---|---|
| **Author** | @ilrudie |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @costinm
> There is no safe way to start using this feature - we can't ask users to add label to all existing SE, turn on the flag ( and make sure no SE is created without the opt out annotation), test the feature in the few namespaces that need it.

### @costinm
> We don't own the 240.240.0.0 range - IETF didn't assign it to Istio and it's not based on 'squatter rights' -the net admins may use this range for other purpose.

### @costinm
> I don't think this should be opt-out - right now majority of users don't enable the auto-allocation and I don't think allocating IPs to all 'backend' SE and subtly changing the behavior is reasonable.

### @howardjohn
> Both are critical use cases, IMO. We must have the _option_ to make all SE auto-allocate to match existing use cases.

### @costinm
> Log, increase a metric. Certainly not kill Istiod and the entire mesh with it.

### @bleggett
> it can be a cidr. I wonder if we need to consume the entire range?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
