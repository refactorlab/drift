# openai/openai-python #1850 — fix(logs): redact sensitive headers

**[View PR on GitHub](https://github.com/openai/openai-python/pull/1850)**

| | |
|---|---|
| **Author** | @kristapratico |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @RobertCraigie
> nit: we have an `is_dict()` header that would make this slightly cleaner imo

### @RobertCraigie
> also I haven't actually written a log filter before, is it bad that this mutates the original `headers` arg?

### @kristapratico
> The logging docs for `filter` permits in-place modification: If deemed appropriate, the record may be modified in-place.

### @RobertCraigie
> note: I _think_ you could've avoided the `_logger_with_filter` stuff by putting all these tests in a class and then doing @pytest.fixture(autouse=True)

### @RobertCraigie
> ugh looks like mypy doesn't understand the type narrowing, feel free to just tell mypy to ignore that whole file.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
