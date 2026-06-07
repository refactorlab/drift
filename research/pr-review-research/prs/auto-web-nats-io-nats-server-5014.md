# nats-io/nats-server #5014 — [ADDED] Distributed Message Tracing

**[View PR on GitHub](https://github.com/nats-io/nats-server/pull/5014)**

| | |
|---|---|
| **Author** | @kozlovic |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ripienaar
> When tracing over an account import/export is it expected that I wont get trace messages once the message cross the account boundary?

### @kozlovic
> The decision was to go through service import only if 'share: true' is specified in the service import. This was for the reason you just mentioned: security concern.

### @derekcollison
> As noted I messed this up, let's switch to allow_trace for service export and stream import.

### @davedotdev
> I wanted to raise for debate, was the ability to turn have tracing domains for NATS servers, so that one or more server or group of servers could ignore the header.

### @hwinkel
> How are the traces exported? Towards 'standard' OTEL collectors like jaeger, tempo etc.? Does the export happens on a per serves bases or centrally like surveyor does?

### @ripienaar
> For now in the interest of getting it in peoples hands via nightly builds this works well.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
