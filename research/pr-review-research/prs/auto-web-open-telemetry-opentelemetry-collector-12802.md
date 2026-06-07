# open-telemetry/opentelemetry-collector #12802 — Update receiverhelper for requests that failed to be received

**[View PR on GitHub](https://github.com/open-telemetry/opentelemetry-collector/pull/12802)**

| | |
|---|---|
| **Author** | @gizas |
| **Status** | Merged (August 25, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jade-guiton-dd
> I don't see any failures for receiver/awsxrayreceiver

(Questioned the unexpected test failures, wondering if testing was against an older code version.)

### @jade-guiton-dd
> The `go.mod` required versions are also still wrong.

### @jade-guiton-dd
> There are still a few issues to fix

(Identified logic issues in the obsreport implementation regarding error classification and metric emission.)

### @jade-guiton-dd
> Are you sure it's related to your changes, and isn't due to a change that was made on main?

(Questioned unrelated test coverage changes in exporterhelper.)

### @jade-guiton-dd
Requested documentation improvements, asking for clarifications in changelog and metadata files about the new metrics and feature gate functionality.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
