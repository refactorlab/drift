# spring-projects/spring-framework #35055 — Document intention of `toString()` in `HandlerMethod`

**[View PR on GitHub](https://github.com/spring-projects/spring-framework/pull/35055)**

| | |
|---|---|
| **Author** | @wonyongg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wonyongg
> The method name `toString()` by itself doesn't make the intention very clear to someone unfamiliar with the HandlerMethod class.

### @sbrannen
> If we were to change something, I suppose we could either make the `HandlerMethod.description` field `protected` or introduce a `getDescription()` method in `HandlerMethod`.

### @sbrannen
> Instead of changing the code or introducing a dedicated method to retrieve the `description`, I think we should just update the Javadoc for `HandlerMethod.toString()` to document that it's used in log/error messages and should typically include the method signature of the handler method.

### @sbrannen
> Thanks for the proposed Javadoc. I've requested minor changes.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
