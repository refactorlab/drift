# espressif/esp-idf #15974 — fix(tools/idf-qemu): Append qemu_extra_args after monitor -serial not before (IDFGH-15315)

**[View PR on GitHub](https://github.com/espressif/esp-idf/pull/15974)**

| | |
|---|---|
| **Author** | @rohfle |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Copilot
> Consider using shlex.split(qemu_extra_args) instead of .split(' ') to correctly handle any quoted arguments and spaces within the extra arguments.

### @igrr
> This one is probably a good suggestion, but we can do it ourselves when merging your PR if you prefer...

### @rohfle
> I agree. Implemented in latest push.

> Note: Review was minimal and focused on one technical improvement — switching from naive string splitting to proper shell argument parsing via `shlex.split()` to correctly handle quoted arguments. The contributor agreed and implemented the change before final approval.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
