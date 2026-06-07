# tesseract-ocr/tesseract #4357 — Fix linear congruential random number generator

**[View PR on GitHub](https://github.com/tesseract-ocr/tesseract/pull/4357)**

| | |
|---|---|
| **Author** | @stweil |
| **Status** | ✅ merged |
| **Opened** | 2024-11-22 |
| **Repo importance** | ★74,507 · 10,653 forks · score 122,103 |
| **Diff** | +7 / −2 across 1 files |
| **Engagement** | 26 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @stweil — 1 reactions  
`👍 1`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4357#issuecomment-2494762624)

> > Does it work with updated parameters like with old rand?
> 
> Yes, the updated parameters are sufficient to fix the assertion and the heap issue.

### @egorpugin — 1 reactions  
`👍 1`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4357#issuecomment-2494766120)

> Good, thank you.
> 
> I'm not well aware of tesseract testing, but I think it is worth to add some of those assert triggering images into the test suite.
> For example, it should be a good test case for my changes with lists.

### @egorpugin — 1 reactions  
`👍 1`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4357#issuecomment-2495501450)

> Code behavior depends on random generator.
> We observe crashes on one generator and do not see them on other.
> 
> That means that the problem is not in rng, but in that code itself.
> Old rng just hides the problem where changes in rng uncover it.
> 
> You can try to change initial seed (`1` currently) to something else and try provided cases with it.

### @egorpugin — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4357#issuecomment-2494682165)

> But what is the reason of incorrect work?
> 
> If we check this table
> https://en.wikipedia.org/wiki/Linear_congruential_generator#Parameters_in_common_use
> 
> we see our parameters from original code
> `MMIX by Donald Knuth | 264 | 6364136223846793005 | 1442695040888963407`
> 
> Here we can find that 
> https://en.cppreference.com/w/cpp/numeric/random
> std::minstd_rand is `std::linear_congruential_engine<std::uint_fast32_t,                                48271, 0, 2147483647`
> 
> Maybe my port was not presicely correct in terms of that `std::minstd_rand` is not exact what it was, I think we should try to make our code use std.
> 
> For example, `using our_rand = std::linear_congruential_engine<std::uint_fast32_t, 6364136223846793005ULL, 1442695040888963407ULL, UINT64_MAX>`

### @egorpugin — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4357#issuecomment-2494686079)

> If new random was more correct, then old code has issues - in that place with `delete` after `assert`.

### @marcreichman-pfi — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4357#issuecomment-2494742520)

> @stweil as i mentioned in those various tickets - this does remove the assertion failures and segfaults. I will point out, in most of these cases, compared to the original for a working variation on one of the bad images, and compared to my alternate assertion fix, the outputs are a bit different. I assume we can attribute that to the difference in random data?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
