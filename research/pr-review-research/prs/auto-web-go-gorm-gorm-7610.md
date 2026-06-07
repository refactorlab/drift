# go-gorm/gorm #7610 — Fix slog logger caller frame detection to output correct source file

**[View PR on GitHub](https://github.com/go-gorm/gorm/pull/7610)**

| | |
|---|---|
| **Author** | @ifooth |
| **Status** | Merged (by jinzhu on Oct 30, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ifooth
> slog是分前端(logger), 后端Handler，官方设计logger是可以按需修改，Handler复用，这里通过NewRecord通过Handler处理也是比较符合社区设计的

### @ZheruiL
> After this PR, the result from calling FileWithLineNum() externally became incorrect. Because CallerFrame() add 1 more frame, please help fix

### @nickxudotme
> Root cause: After extracting `CallerFrame()` from `FileWithLineNum()`, one extra frame was added to the call stack, but `runtime.Callers(3, ...)` was not adjusted

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
