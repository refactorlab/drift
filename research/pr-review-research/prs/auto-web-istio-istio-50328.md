# istio/istio #50328 — Idempotency for istio-iptables apply flow

**[View PR on GitHub](https://github.com/istio/istio/pull/50328)**

| | |
|---|---|
| **Author** | @leosarra |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bleggett
> I would prefer _not_ to make this a flag, and simply do it every time, which should be fine if it is idempotent.

### @howardjohn
> doesn't delete+apply cause downtime if we are to actually apply this somewhere with rules already? Thinking of VMs, etc? This seems dangerous

### @howardjohn
> We can keep it on by default but at least should have a feature flag to turn it off, since this is very tricky behavior...probably there is some weird edge cases.

### @bleggett
> To retain the old behavior, we should log this as a warning but attempt to execute as well...we are doing `iptables-save` parsing which is, historically, hard to do right.

### @howardjohn
> Can we keep the backwards compatible behavior of always running it?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
