# clash-verge-rev/clash-verge-rev #6487 — feat(tray): 恢复并重构托盘显示速率功能

**[View PR on GitHub](https://github.com/clash-verge-rev/clash-verge-rev/pull/6487)**

| | |
|---|---|
| **Author** | @share-man-man |
| **Status** | ✅ merged |
| **Opened** | 2026-03-12 |
| **Repo importance** | ★123,321 · 8,979 forks · score 164,226 |
| **Diff** | +719 / −5 across 13 files |
| **Engagement** | 32 conversation · 14 inline review comments |

## Top review comments (ranked by reactions)

### @share-man-man — 12 reactions  
`👍 7 · ❤️ 5`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6487#issuecomment-4144163075)

> > 虽然很想要这个功能, 但是显示在一行占位甚至会大于三个 tray 的宽度, 并且随着速率变化宽度左右跳动, 对于 macOS 特别是刘海屏寸土寸金的 menubar 区域很难受, 如果能将速率显示在一列并定宽就完美了
> 
> 前几天比较忙，今晚有空使用objc2实现了显示两行速率。且验证了单色图标、多色图标在暗色、白色主题下，都不会出现闪烁的情况
> 
> https://github.com/user-attachments/assets/64cb916f-70fc-4e8a-8feb-96edfdcd0ab5
> 
> https://github.com/user-attachments/assets/195e6053-1625-4f45-b2b9-1fd9274ca394
> 
> https://github.com/user-attachments/assets/258aff84-bb59-4c79-bf1e-beeb8d279506

### @brookqin — 2 reactions  
`👍 2`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6487#issuecomment-4122397757)

> 虽然很想要这个功能, 但是显示在一行占位甚至会大于三个 tray 的宽度, 并且随着速率变化宽度左右跳动, 对于 macOS 特别是刘海屏寸土寸金的 menubar 区域很难受, 如果能将速率显示在一列并定宽就完美了

### @share-man-man — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6487#issuecomment-4048180603)

> > @share-man-man
> > 
> > `~/Changelog.md` 顺手一下吧
> 
> 已提交

### @share-man-man — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6487#issuecomment-4065416169)

> > 实际上，移除该功能是因为在 macos 主题机制下，壁纸色彩会影响托盘主题。特定情况下会导致托盘速率更新时快速闪烁。麻烦协助测试下当前实现仍能触发吗？
> 
> 我复现了以前闪烁的bug：
> 
> https://github.com/user-attachments/assets/695c3872-7bf0-471d-84f1-0629d9886dde
> 
> 出现这个问题的原因：使用的是`图标绘制`的方案，导致mac是浅色壁纸时，绘制图表会出现闪烁的情况。现在的解决方案是`tray.set_title(...)` 这条实现路径，虽然不能绘制两行速率，但是不会出现闪烁，效果如下：
> 
> https://github.com/user-attachments/assets/6192a3d9-7a30-41cd-aa2f-f3fae038d1ba

### @Tychristine — 0 reactions  
`—`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6487#issuecomment-4046538434)

> @share-man-man 
> 
> `~/Changelog.md` 顺手一下吧

### @share-man-man — 0 reactions  
`—`  ·  [link](https://github.com/clash-verge-rev/clash-verge-rev/pull/6487#issuecomment-4053131872)

> > <img alt="image" width="133" height="30" src="https://private-user-images.githubusercontent.com/6077601/562800758-ee42bdfc-af02-4762-9101-600483adcde0.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzMzODQxNTIsIm5iZiI6MTc3MzM4Mzg1MiwicGF0aCI6Ii82MDc3NjAxLzU2MjgwMDc1OC1lZTQyYmRmYy1hZjAyLTQ3NjItOTEwMS02MDA0ODNhZGNkZTAucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQVZDT0RZTFNBNTNQUUs0WkElMkYyMDI2MDMxMyUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNjAzMTNUMDYzNzMyWiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9NGFjMTYwZmI2NmQxZDI3NDkxNTUyMjIyYmE1NTI4NDU1MjU4YWYyNDJhN2QyZGE1OTc2NTQzODY3YTQzNDEwNCZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QifQ.wd6v2G5w4rzPePwNcVi2gGkuQONNniiMM6Vk8KQG4ao"> ,too long. hope two rows. one col.
> 
> I initially thought the same, but since this is a native capability of macOS and considering compatibility with Windows and Linux, it can only be displayed as a single line.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
