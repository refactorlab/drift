# spring-projects/spring-boot #49839 — Document the need for Liquibase and Flyway starters

**[View PR on GitHub](https://github.com/spring-projects/spring-boot/pull/49839)**

| | |
|---|---|
| **Author** | @ppapaj |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wilkinsona
> Rather than adding a note, I think it would be better to update the documentation that talks about the Flyway and Liquibase dependencies

### @wilkinsona
> There's no need for both dependencies as `liquibase-core` is a dependency of `spring-boot-starter-liquibase`.

### @wilkinsona
> This isn't quite right. We should instruct users to add `spring-boot-starter-flyway`. That's all they need for in-memory and file-based DBs.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
