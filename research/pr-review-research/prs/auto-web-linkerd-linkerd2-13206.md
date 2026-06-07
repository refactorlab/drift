# linkerd/linkerd2 #13206 — policy: Serve EgressNetwork responses

**[View PR on GitHub](https://github.com/linkerd/linkerd2/pull/13206)**

| | |
|---|---|
| **Author** | @zaharidichev |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @adleong
> I'm surprised to see TrafficPolicy here in the discover target. I think this means that the TrafficPolicy is looked up once at the beginning of the discovery lookup but then never updated. If the EgressNetwork resource is edited to change the TrafficPolicy, I don't think the discovery watches will see that change.

### @adleong
> It really seems like we need to take a different approach for EgressNetworks compared to the approach we have for services in the outbound index. Perhaps we can take advantage of the fact that cluster networks are immutable.

### @adleong
> Can we simplify this all by skipping the step of transforming OutboundPolicy into OutboundPolicyKind and instead just directly transform OutboundPolicy into proxy-api response? This will require passing in the orig_dst as supplemental information, but I think that's okay.

### @adleong
> This means that for external targets that are not covered by an EgressNetwork, we'll return Opaque. Does this differ from the current behavior? I assume that today we return NotFound for these and then the proxy uses the profile resolution.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
