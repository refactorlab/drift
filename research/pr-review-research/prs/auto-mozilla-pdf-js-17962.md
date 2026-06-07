# mozilla/pdf.js #17962 — Use BiDi protocol for Chrome tests

**[View PR on GitHub](https://github.com/mozilla/pdf.js/pull/17962)**

| | |
|---|---|
| **Author** | @calixteman |
| **Status** | ✅ merged |
| **Opened** | 2024-04-17 |
| **Repo importance** | ★53,401 · 10,625 forks · score 100,897 |
| **Diff** | +8 / −10 across 2 files |
| **Engagement** | 109 conversation · 5 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @calixteman — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/17962#issuecomment-2063261440)

> @OrKoN the ref tests failed on the linux bot because of an OOM crash. The bot has a 64 bits OS with 16Gb of RAM and afaik we never had this kind of issues with CDP in the last years.
> And on the windows bot, it failed in the middle of the unit test with an exception (`TargetCloseError: Protocol error (Runtime.callFunctionOn): Target closed`).

### @OrKoN — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/17962#issuecomment-2063680749)

> @calixteman do all tests use Puppeteer or only integration?

### @OrKoN — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/17962#issuecomment-2063682684)

> I think I am not able to view the logs but I will give it a try later

### @calixteman — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/17962#issuecomment-2063706384)

> > @calixteman do all tests use Puppeteer or only integration?
> 
> The unit/ref/integration tests are using Puppeteer.

### @calixteman — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/17962#issuecomment-2063708803)

> > I think I am not able to view the logs but I will give it a try later
> 
> You should be able to just look at  http://54.193.163.58:8877/81255050207bcff/output.txt

### @timvandermeij — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/17962#issuecomment-2063780941)

> @OrKoN The logs of the runs that crashed due to OOM can be found at http://54.241.84.105:8877/9e74d8b32fd9a8a/output.txt for the first try and at http://54.241.84.105:8877/17e8528589e75e3/output.txt for the second try. Both crashed during the reference tests. For completeness I'll also include the relevant bit here (the `TEST-PASS` line is the last bit of the PDF.js code):
> 
> ```
> TEST-PASS | eq test issue13751 | in firefox
> 
> <--- Last few GCs --->
> 
> [4032:0x6eba470]   422579 ms: Scavenge (reduce) 4087.8 (4127.6) -> 4087.9 (4128.6) MB, 2.1 / 0.0 ms  (average mu = 0.145, current mu = 0.047) allocation failure; 
> [4032:0x6eba470]   422585 ms: Scavenge (reduce) 4088.8 (4128.6) -> 4088.7 (4129.3) MB, 3.1 / 0.0 ms  (average mu = 0.145, current mu = 0.047) allocation failure; 
> 
> <--- JS stacktrace --->
> 
> FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
>  1: 0xb7a940 node::Abort() [node]
>  2: 0xa8e823  [node]
>  3: 0xd5c940 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, bool) [node]
>  4: 0xd5cce7 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, bool) [node]
>  5: 0xf3a3e5  [node]
>  6: 0xf3b2e8 v8::internal::Heap::RecomputeLimits(v8::internal::GarbageCollector) [node]
>  7: 0xf4b7f3  [node]
>  8: 0xf4c668 v8::internal::Heap::CollectGarbage(v8::internal::AllocationSpace, v8::internal::GarbageCollectionReason, v8::GCCallbackFlags) [node]
>  9: 0xf26fce v8::internal::HeapAllocator::AllocateRawWithLightRetrySlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::Allocatio … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
