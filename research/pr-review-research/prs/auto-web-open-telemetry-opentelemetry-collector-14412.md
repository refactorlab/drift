# open-telemetry/opentelemetry-collector #14412 — Add typed collector resource attributes based on declarative config

**[View PR on GitHub](https://github.com/open-telemetry/opentelemetry-collector/pull/14412)**

| | |
|---|---|
| **Author** | @iblancasa |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jade-guiton-dd
> I think implementing the declarative config's resource struct in `service/internal/resource` and using it in `service/telemetry/otelconftelemetry` is not a good idea and goes against the existing architecture.

### @jade-guiton-dd
> I think there's a lot to simplify, remove, or delegate to otelconf here; we probably don't need +2700 new lines of code for this.

### @jade-guiton-dd
Suggested relying on otelconf's Resource implementation with migration logic for backward compatibility rather than creating new structures.

### @dmitryax
Questioned whether SDK detectors would function with OpAMP extension/supervisor and expressed concern about "two separate solutions in the same binary that could potentially diverge and produce different results."

### @evan-bradley
> if the Collector is overloaded, sending it's own telemetry to itself before processing makes the problem worse and risks that telemetry not making it to a backend in a timely manner.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
