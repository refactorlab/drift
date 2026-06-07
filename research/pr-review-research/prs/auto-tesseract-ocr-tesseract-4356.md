# tesseract-ocr/tesseract #4356 — Make list classes templated

**[View PR on GitHub](https://github.com/tesseract-ocr/tesseract/pull/4356)**

| | |
|---|---|
| **Author** | @egorpugin |
| **Status** | ✅ merged |
| **Opened** | 2024-11-22 |
| **Repo importance** | ★74,507 · 10,653 forks · score 122,103 |
| **Diff** | +2900 / −3440 across 49 files |
| **Engagement** | 16 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @egorpugin — 1 reactions  
`👍 1`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4356#issuecomment-2494264625)

> It is probably worth to rename those lists to more clear names.
> 
> ```
> CLIST -> ConsList
> ELIST -> IntrusiveList or IntrusiveLinkedList or IntrusiveForwardList (like in STL one directional list)
> ELIST2 -> IntrusiveDoublyLinkedList or IntrusiveBidirectionalList or IntrusiveList (like in STL bidi list)
> ```

### @egorpugin — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4356#issuecomment-2492653456)

> And we need this as part of updating memory management to unique ptrs.
> So types are real types and not `void *`.
> 
> Feel free to contribute and push changes to this PR, so we can update things together (like Makefile changes).

### @egorpugin — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4356#issuecomment-2493896766)

> part2 
> 
> Converted ELIST, not pushing it at the moment to keep this PR more clear.
> 
> Tested on windows.
> ```
> Test results:
> TOTAL:   63
> PASSED:  60
> FAILED:  0
> SKIPPED: 3
> ```

### @stweil — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4356#issuecomment-2494150614)

> CI tests fail. Here is the first failure from `make check`:
> ```
> % ./layout_test 
> layout_test(46416,0x1ec96f840) malloc: nano zone abandoned due to inability to reserve vm space.
> Running main() from ../../../unittest/third_party/googletest/googletest/src/gtest_main.cc
> [==========] Running 3 tests from 1 test suite.
> [----------] Global test environment set-up.
> [----------] 3 tests from LayoutTest
> [ RUN      ] LayoutTest.ArraySizeTest
> [       OK ] LayoutTest.ArraySizeTest (0 ms)
> [ RUN      ] LayoutTest.UNLV8087_054
> =================================================================
> ==46416==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x613000099e28 at pc 0x000105951a08 bp 0x00016b412010 sp 0x00016b412008
> READ of size 8 at 0x613000099e28 thread T0
> ```
> 
> `resultiterator_test` also shows a `heap-buffer-overflow`.

### @egorpugin — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4356#issuecomment-2494154823)

> I see them running currently. Where is that error from?

### @egorpugin — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4356#issuecomment-2494259935)

> Ok, seems CIs are happy. Atleast what I see in this PR.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
