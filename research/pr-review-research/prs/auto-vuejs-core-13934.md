# vuejs/core #13934 — test(vapor): use browser mode instead of pupeteer to run tests

**[View PR on GitHub](https://github.com/vuejs/core/pull/13934)**

| | |
|---|---|
| **Author** | @sheremet-va |
| **Status** | ✅ merged |
| **Opened** | 2025-09-26 |
| **Repo** | curated review-culture seed |
| **Diff** | +1184 / −1023 across 10 files |
| **Engagement** | 13 conversation · 17 inline review comments |

## Top review comments (ranked by reactions)

### @sheremet-va — 1 reactions  
`👍 1`  ·  [link](https://github.com/vuejs/core/pull/13934#issuecomment-3343072558)

> > have a question: after switching to vitest browser mode, does the e2e test execution time increase or decrease? If the difference isn't too significant, I think this PR is worthwhile.
> 
> The time is unpredictable with the previous approach for me, the first time it's ~2s, the second time ~1,5s. The browser mode runs for 2s (the MVC test is always 1,5s unlike with pupeteer where it's either 1,5s or 700ms). I think it might be because the previous setup was modifying the DOM directly (by setting `input.value` or doing a `element.click()` instead of using CDP which is slower). If we keep the previous _implementation_, I think the time will be the same, if not a little bit faster.

### @edison1105 — 0 reactions  
`—`  ·  [link](https://github.com/vuejs/core/pull/13934#issuecomment-3342191202)

> I've actually been planning to switch e2e tests to vitest browser mode too, but I haven't done it yet since vitest browser mode is still experimental. I have a question: after switching to vitest browser mode, does the e2e test execution time increase or decrease? If the difference isn't too significant, I think this PR is worthwhile.

### @edison1105 — 0 reactions  
`—`  ·  [link](https://github.com/vuejs/core/pull/13934#issuecomment-3343402570)

> @sheremet-va 
> Sounds good to me. Let's move all e2e tests to vitest browser mode.

### @sheremet-va — 0 reactions  
`—`  ·  [link](https://github.com/vuejs/core/pull/13934#issuecomment-3398193549)

> I will come back to this PR at some point. @edison1105 right now I am struggling with running unit tests in Vitest beta. It seems like `BaseTransition.spec.ts` is failing with the [latest version](https://github.com/vitest-dev/vitest-ecosystem-ci/actions/runs/18455904730/job/52577183354) (it's not the only test that fails) and I am not sure _why_. It seems like something was introduce in Vitest (probably related to spying) that is causing this. Can you help me debug it?

### @sheremet-va — 0 reactions  
`—`  ·  [link](https://github.com/vuejs/core/pull/13934#issuecomment-3436091092)

> The main issue I am having with VItest 4 is that unit tests are failing. Did you have a loot at them yet, @edison1105?

### @edison1105 — 0 reactions  
`—`  ·  [link](https://github.com/vuejs/core/pull/13934#issuecomment-3437160386)

> @sheremet-va 
> ```js
> // in vitest 3.2.4
> const hook = vi.fn((el, done) => {})
> test('hook length', () => {
>   expect(hook.length).toBe(2) // true
> })
> 
> // in vitest 4.x
> const hook = vi.fn((el, done) => {})
> test('hook length', () => {
>   expect(hook.length).toBe(2) // should be 2 but got 0
> })
> ```
> The above difference is the cause of the `BaseTransition.spec.ts` failed. Internally, Transition uses `hook.length` to determine whether the animation has ended. If `hook.length <= 1`, `done` will be called.
> 
> https://github.com/vuejs/core/blob/45547e69b25baa99a0ed52ba5110c5bd8b4a35e4/packages/runtime-core/src/components/BaseTransition.ts#L360-L371
> 
> ---
> 
> Another test case (componentPublicInstance.spec.ts:348:28) failed. Simply change the 4 to 3. Refer to the comments in L344. (It equals 3 in jest) - You already fixed it via https://github.com/vuejs/core/pull/13934/commits/7e56f8d045b2334bee9b63ab5c210cb400ba12da.
> https://github.com/vuejs/core/blob/45547e69b25baa99a0ed52ba5110c5bd8b4a35e4/packages/runtime-core/__tests__/componentPublicInstance.spec.ts#L344-L348


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
