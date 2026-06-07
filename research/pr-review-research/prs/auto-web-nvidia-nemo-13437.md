# NVIDIA/NeMo #13437 — OneLogger Integration

**[View PR on GitHub](https://github.com/NVIDIA/NeMo/pull/13437)**

| | |
|---|---|
| **Author** | @PytLab |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @weiqingw4ng
> Can this function be called multiple times? It is called here and then called in function `self.restore_from`. This raises an error for my training when I try to load a checkpoint for finetuning

*(Reported a `OneLoggerError: Cannot start timer since it is already active` blocking a model release.)*

### @tango4j
> This error is blocking our model release. Will there be a issue if we disable this for 'restore_from' function? Clearly, this fine-tuning case (restoring a checkpoint) is not tested, and causing errors.

### @leoleoasd
> Why is OneLoggerNeMoCallback enabled by default?

### @leoleoasd
> Why don't add this callback only after user configure it explicitly?

### @PytLab
> should be fine. it wont break one-logger instrumentation. but if there is a case where use only calls the `restore_from` for ckpt loading, with this removed, one-logger may lose some trace metrics for checkpoint_loading overheads.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
