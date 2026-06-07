# foundry-rs/foundry #10190 — feat(forge): coverage guided fuzzing & time based campaigns for invariant mode

**[View PR on GitHub](https://github.com/foundry-rs/foundry/pull/10190)**

| | |
|---|---|
| **Author** | @0xalpharush |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @DaniPopes
> Well we're replacing the invariant runner by default with no fallback, I would at least check if we haven't had any regressions in performance and behavior

### @0xalpharush
> I thought this would not be the default behavior as a user must add some configs to their foundry.toml to enable it

### @0xalpharush
> Ideally we'd have the ABI sig here and not have to call `from_invariant_call` all of the time to recover it

### @0xalpharush
> b7f09d8 operated under the assumption that the libafl function updated the history map, but it doesn't

### @0xalpharush
> I think there's a lot to be improved, but this unblocks running the fuzzer with coverage for hours on end and restarting from scratch as the corpus is cumulative

### @wtdcode
> A side question: why not depend on LibAFL to avoid duplicate code?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
