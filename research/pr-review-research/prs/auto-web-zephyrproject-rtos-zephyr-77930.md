# zephyrproject-rtos/zephyr #77930 — A new non volatile storage system

**[View PR on GitHub](https://github.com/zephyrproject-rtos/zephyr/pull/77930)**

| | |
|---|---|
| **Author** | @rghaddab |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Laczen
> And this will be exactly where the problem of code duplication pops up. Every change or optimization you make to the ZMS settings backend will also need to be evaluated for the nvs settings backend, and if appropriate changed in both locations.

### @de-nordic
> The PR here does not remove NVS nor does it take architectural ownership on it from you. The PR here provides a parallel solution bringing improvements that would [support] users with devices so far not supported.

### @frkv
> The amount of fs->flash_parameters->write_block_size calls makes me wonder if this should be a static inline `get_write_block_size(fs)` or maybe something that also includes the arithmetic.

### @Laczen
> When you are contributing to the settings backend you should feel the same responsibility, when you apply optimisations to a ZMS backend you should also evaluate if these changes can also be used in NVS.

### @rghaddab
> ZMS is not a replacement of NVS, each one of them has its own usecases and hw requirements. mixing both of them will make the final solution worse than both of them.

### @tomi-font
> I haven't found anything that merits delaying this any longer

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
