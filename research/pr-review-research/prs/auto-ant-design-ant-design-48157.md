# ant-design/ant-design #48157 — feat: progress add inside and bottom text position

**[View PR on GitHub](https://github.com/ant-design/ant-design/pull/48157)**

| | |
|---|---|
| **Author** | @LonelySnowman |
| **Status** | ✅ merged |
| **Opened** | 2024-03-28 |
| **Repo importance** | ★98,276 · 54,631 forks · score 321,798 |
| **Diff** | +1445 / −693 across 12 files |
| **Engagement** | 35 conversation · 76 inline review comments |

## Top review comments (ranked by reactions)

### @li-jia-nan — 1 reactions  
`👍 1`  ·  [link](https://github.com/ant-design/ant-design/pull/48157#issuecomment-2029103689)

> 需要的：`npm run test:update components/progress`

### @li-jia-nan — 1 reactions  
`👍 1`  ·  [link](https://github.com/ant-design/ant-design/pull/48157#issuecomment-2029982043)

> 看起来并没有完全居中：
> 
> <img width="747" alt="image" src="https://github.com/ant-design/ant-design/assets/49217418/99c0483b-b678-4d57-8c63-69bee1db26a3">

### @afc163 — 1 reactions  
`👍 1`  ·  [link](https://github.com/ant-design/ant-design/pull/48157#issuecomment-2071295979)

> <img width="603" alt="图片" src="https://github.com/ant-design/ant-design/assets/507615/fc942abd-991d-4ec8-ac89-ef4784f586ad">
> 
> 放在后面也能加上自适应不，让行为保持一致。

### @LonelySnowman — 1 reactions  
`👍 1`  ·  [link](https://github.com/ant-design/ant-design/pull/48157#issuecomment-2077742592)

> 内部改成了 flex 布局，改变了原有的高度，visual diff 均有一部分向上的偏移。
> ![1d1b2569ec66ed5e0caa97c7a16ec0f](https://github.com/ant-design/ant-design/assets/111493458/39f17d04-4523-4cfa-8349-1df7b7afdf54)
> @afc163 大佬看看这个效果可行不。

### @afc163 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/ant-design/ant-design/pull/48157#issuecomment-2081787711)

> Progress 的高度被压缩了：https://antd-visual-diff.oss-cn-shanghai.aliyuncs.com/pr-48157/visualRegressionReport/report.html
> 
> <img width="1124" alt="图片" src="https://github.com/ant-design/ant-design/assets/507615/b4f6ce84-279f-4949-bb09-25f526e7285b">
> 
> 可以试试把 outer 上的 style 都去掉，应该不需要这两个样式了。
> 
> <img width="681" alt="图片" src="https://github.com/ant-design/ant-design/assets/507615/31773c93-cd1b-4eba-897f-b5a31aeb3130">

### @afc163 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/ant-design/ant-design/pull/48157#issuecomment-2090601206)

> 看下 `component-token.tsx` 这个演示的 diff，貌似有点问题。
> 
> https://antd-visual-diff.oss-cn-shanghai.aliyuncs.com/pr-48157/visualRegressionReport/report.html


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
