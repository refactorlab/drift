# foundry-rs/foundry #8571 — feat(cheatcode): `startDebugTraceRecording` and `stopDebugTraceRecording` for ERC4337 testing

**[View PR on GitHub](https://github.com/foundry-rs/foundry/pull/8571)**

| | |
|---|---|
| **Author** | @boolafish |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @DaniPopes
> This is not the right path, we already have a tracer and we should reuse that through CheatcodeExecutor

### @klkvr
> yep, I think this could be possible by extending `CheatcodesExecutor` with something like this: fn start_steps_recording(&mut self, cheats: &mut Cheatcodes); fn get_recorded_step(&mut self, cheats: &mut Cheatcodes) -> Vec<CallTraceStep>

### @klkvr
> I think we should move logic for `start_steps_recording` and `stop_and_get_recorded_step` from `CheatcodesExecutor` to cheatcode implementations

### @klkvr
> regarding `more traces were filled than started` I think this occurs because in cases when tracing is disabled and `vm.startDebugTraceRecording` enables tracer, tracer will receive a `call_end` invocation

### @klkvr
> if summing up this adds steps tracing through cheatodes, only supported when tracing is enabled via increased verbosity or other flags

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
