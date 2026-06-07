# opencv/opencv #24938 — G-API OV backend requires cv::MediaFrame

**[View PR on GitHub](https://github.com/opencv/opencv/pull/24938)**

| | |
|---|---|
| **Author** | @DariaMityagina |
| **Status** | ✅ merged |
| **Opened** | 2024-01-29 |
| **Repo importance** | ★87,790 · 56,575 forks · score 319,089 |
| **Diff** | +301 / −31 across 2 files |
| **Engagement** | 19 conversation · 92 inline review comments |

## Top review comments (ranked by reactions)

### @TolyaTalamanov — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/opencv/opencv/pull/24938#issuecomment-1917313186)

> > Need to investigate this issue in one of the test cases - WIP: https://github.com/openvinotoolkit/open_model_zoo/actions/runs/7700178002/job/20983409804?pr=3903
> > 
> > ```
> > [ ERROR ] OpenCV(4.9.0-dev) /home/runner/work/open_model_zoo/open_model_zoo/cache/opencv-with-fix/opencv/modules/core/src/matrix_wrap.cpp:1667: error: (-215:Assertion failed) !fixedSize() in function 'release'
> > ```
> 
> Will be glad to help if it hasn't been resolved yet

### @asmorkalov — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/24938#issuecomment-1945990047)

> @DariaMityagina Github actions are triggered automatically for OpenCV organization members only. I approved built for you.

### @asmorkalov — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/24938#issuecomment-2028755178)

> @DariaMityagina @TolyaTalamanov Friendly reminder.

### @DariaMityagina — 0 reactions  
`—`  ·  [link](https://github.com/opencv/opencv/pull/24938#issuecomment-1916788290)

> Need to investigate this issue in one of the test cases - WIP:
> https://github.com/openvinotoolkit/open_model_zoo/actions/runs/7700178002/job/20983409804?pr=3903
> ```
> [ ERROR ] OpenCV(4.9.0-dev) /home/runner/work/open_model_zoo/open_model_zoo/cache/opencv-with-fix/opencv/modules/core/src/matrix_wrap.cpp:1667: error: (-215:Assertion failed) !fixedSize() in function 'release'
> ```

### @DariaMityagina — 0 reactions  
`—`  ·  [link](https://github.com/opencv/opencv/pull/24938#issuecomment-1919047775)

> > > Need to investigate this issue in one of the test cases - WIP: https://github.com/openvinotoolkit/open_model_zoo/actions/runs/7700178002/job/20983409804?pr=3903
> > > ```
> > > [ ERROR ] OpenCV(4.9.0-dev) /home/runner/work/open_model_zoo/open_model_zoo/cache/opencv-with-fix/opencv/modules/core/src/matrix_wrap.cpp:1667: error: (-215:Assertion failed) !fixedSize() in function 'release'
> > > ```
> > 
> > Will be glad to help if it hasn't been resolved yet
> 
> Thanks a lot!
> I think I found the problem, I'm working on a fix now.

### @DariaMityagina — 0 reactions  
`—`  ·  [link](https://github.com/opencv/opencv/pull/24938#issuecomment-1923536795)

> Opened this PR for review.
> 
> [This ](https://github.com/opencv/opencv/pull/24938#issuecomment-1916788290) issue is going to be addressed in a follow-up ticket - 111291.
> Since it only affected `instance-segmentation-security-0091` case in OMZ demos check, I only enabled passing `instance-segmentation-person-0007` case for now (please see https://github.com/openvinotoolkit/open_model_zoo/pull/3903).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
