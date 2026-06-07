# trinodb/trino #24117 — Add support for fetching Redshift query results using Redshift unload command

**[View PR on GitHub](https://github.com/trinodb/trino/pull/24117)**

| | |
|---|---|
| **Author** | @mayankvadariya |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mosabua
> Please describe what this actually does for user .. seems like it is only a performance improvement .. right? And if so .. why is it called unload?

### @mosabua
> I assume we need to explain that they need a S3 account and whatever else .. and when this should and should not be used.. I am not aware of this info so I cant really reword appropriately without more details

### @raunaqmorarka
> lgtm % comments

### @ebyhr
> *(Multiple resolved review threads on implementation details across `RedshiftSessionProperties`, `RedshiftPageSource`, and the test files — comprehensive code-quality and design feedback.)*

### @findinpath
> *(Multiple resolved comments on `RedshiftUnloadSplitManager` and `RedshiftSplitSource` implementation — technical implementation review and optimization concerns.)*

---
*Note: PRs #24117 used a large number of inline file-level review threads (now resolved/collapsed) from @ebyhr and @findinpath whose verbatim text did not render on the conversation page; those reviewers and the topics they covered are summarized above. The fully-quotable comments are from @mosabua and @raunaqmorarka.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
