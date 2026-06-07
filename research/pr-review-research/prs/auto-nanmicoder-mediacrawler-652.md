# NanmiCoder/MediaCrawler #652 — feat(bilibili): Add flexible search modes and fix limit logic

**[View PR on GitHub](https://github.com/NanmiCoder/MediaCrawler/pull/652)**

| | |
|---|---|
| **Author** | @gaoxiaobei |
| **Status** | ✅ merged |
| **Opened** | 2025-07-12 |
| **Repo importance** | ★50,760 · 10,681 forks · score 98,373 |
| **Diff** | +387 / −247 across 18 files |
| **Engagement** | 19 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @NanmiCoder — 0 reactions  
`—`  ·  [link](https://github.com/NanmiCoder/MediaCrawler/pull/652#issuecomment-3078428085)

> I looked at `base_config.py` which introduces some configuration items, such as `MAX_NOTES_PER_DAY` and similar ones. The user's impression is that it should support all platforms, but in reality it only supports Bilibili. I don't recommend making this type of change. These time interval changes specifically targeted at Bilibili already had a sense of specificity when they were first implemented. I suggest looking for alternative approaches.

### @gaoxiaobei — 0 reactions  
`—`  ·  [link](https://github.com/NanmiCoder/MediaCrawler/pull/652#issuecomment-3078644337)

> Yes, the daily crawling limit is specifically designed for bilibili only, as this is an addition to the existing `ALL_DAY` configuration item. As mentioned in the original comments, the `ALL_DAY` item only applies to bilibili keyword searches. I'm not sure if this specific targeting originates from the platform's characteristics, so I did not expand the range of supported platforms.

### @gaoxiaobei — 0 reactions  
`—`  ·  [link](https://github.com/NanmiCoder/MediaCrawler/pull/652#issuecomment-3078700592)

> According to my understanding, platforms like `xhs`, `wb`, `tieba`, etc., do not support displaying content in time order, while the `bilibili` platform does. This indicates that it is more difficult to control the number of notes per day on these platforms.

### @gaoxiaobei — 0 reactions  
`—`  ·  [link](https://github.com/NanmiCoder/MediaCrawler/pull/652#issuecomment-3078719346)

> Considering the technical limitations, would it be a compromise to add comments informing the users that the configuration options I've added are specifically for the `bilibili` platform?

### @2513502304 — 0 reactions  
`—`  ·  [link](https://github.com/NanmiCoder/MediaCrawler/pull/652#issuecomment-3079359131)

> In fact, the Weibo platform also supports the function of filtering by time period, with the minimum time interval being one hour.

### @2513502304 — 0 reactions  
`—`  ·  [link](https://github.com/NanmiCoder/MediaCrawler/pull/652#issuecomment-3079369773)

> > 事实上，微博平台也支持按时间段筛选的功能，最小时间间隔为 1 小时。
> 
> Of course, I'm just saying that from a technical implementation perspective, it is supported. However, this option is not currently available in this repository. If possible, adding a feature enhancement for time period filtering on the Weibo platform could reduce this specialized behavior.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
