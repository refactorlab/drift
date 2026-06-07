# grpc/grpc-go #7677 — stats/opentelemetry: introduce tracing propagator and carrier

**[View PR on GitHub](https://github.com/grpc/grpc-go/pull/7677)**

| | |
|---|---|
| **Author** | @purnesh42H |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zasweq
> I don't know what these comments semantically refer to. What does 'cross-cutting concerns' mean?

### @zasweq
> Is this the correct error message? I think both in the case it's not present in md and if it's set to an empty byte string it'll be not found.

### @zasweq
> I don't get the point of this API. It seems to do things by deferring to operations on a context either to the stats package or the metadata package?

### @dfawley
> This is strange. Maybe we should be initializing the carrier differently from the two directions? I don't want the outgoing operation's Keys() to return incoming metadata.

### @dfawley
> Can we unexport this and have NewIncomingCarrier and NewOutgoingCarrier?

(and)

> Custom in the name seems to add nothing of value. Just Carrier is fine since it's in an internal tracing package?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
