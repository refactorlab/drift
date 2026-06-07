# zephyrproject-rtos/zephyr #89776 — drivers: sdio: Support SDIO driver for STM32

**[View PR on GitHub](https://github.com/zephyrproject-rtos/zephyr/pull/89776)**

| | |
|---|---|
| **Author** | @ExaltZephyr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pillo79
> devicetree error: 'disk-name' is marked as required in 'properties:' in zephyr/dts/bindings/sdhc/st,stm32-sdhc.yaml, but does not appear

### @danieldegrasse
> if we can use use the sdio subsystem test for this I'd prefer not to add another test with overlapping functionality

### @fabiobaltieri
> this is still going to be blocked on the release so it's not like it'd be merged before next week anyway

### @etienne-lms
> LGTM (preferably with CoPilot comments addressed)

### @danieldegrasse
> I might change this to a LOG_ERR. Users should have a relatively easy way to see that this driver only supports the SDIO stack.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
