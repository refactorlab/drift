# apache/cassandra #3696 — Add JDK21 support

**[View PR on GitHub](https://github.com/apache/cassandra/pull/3696)**

| | |
|---|---|
| **Author** | @jmckenzie-dev |
| **Status** | Merged (February 2, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ekaterinadimitrova2
> I am not sure we should change config parameters based on the assumption people will use directly JDK21 on the next major.

### @ekaterinadimitrova2
> some tests' changes were not reverted after we agreed not to change defaults for config - this breaks config tests.

### @pron
> --add-opens/--add-exports flags are FIXME markers signifying non-portable code. Even if working across versions, it can't work for long.

### @jmckenzie-dev
> I'll revert the experimental bytebuddy again and see how it behaves ... double-check to make sure I captured all the changed default GC params.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
