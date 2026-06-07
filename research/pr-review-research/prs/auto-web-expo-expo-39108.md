# expo/expo #39108 — [expo-calendar][next] Implement `ExpoCalendar@next`

**[View PR on GitHub](https://github.com/expo/expo/pull/39108)**

| | |
|---|---|
| **Author** | @kosmydel |
| **Status** | Merged (merged by lukmccall on Oct 27, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lukmccall
> Was there any reason behind calling it rrFormat?

### @lukmccall
> Can we make the title field non-nullable within the record, so we don't have to add this check?

### @arturgesiarz
> I decided to use coroutines on the Android side, which made most methods asynchronous. To ensure API compatibility with iOS, I also converted synchronous methods to asynchronous ones there

### @lukmccall
> Instead of using random indexes, can we use column names? It seems weird

### @lukmccall
> Do we need to implement Serializable interface?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
