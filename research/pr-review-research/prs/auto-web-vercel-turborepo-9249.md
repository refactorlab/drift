# vercel/turborepo #9249 — handle VERCEL_ARTIFACTS_* env vars override

**[View PR on GitHub](https://github.com/vercel/turborepo/pull/9249)**

| | |
|---|---|
| **Author** | @dimitropoulos |
| **Status** | Merged (by tknickman on October 18, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @chris-olszewski
> This is an amazing write up of the existing + desired behavior. The only blocking comment is making sure that we keep the same level of user facing error messaging if we encounter a non-UTF8 value.

### @chris-olszewski
> I feel that changing the parameter for `get_configuration_options` doesn't provide us with much, but that's just an opinion.

### @tknickman
> Suggested changing "looking for _paris_" to "looking for _pairs_" in documentation comments about environment variable pairing logic.

### @chris-olszewski
> LGTM! Comment on the `Output::from` implementation is total taste and up to you.

### @tknickman
> Approved after final revisions were made addressing the environment variable precedence logic.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
