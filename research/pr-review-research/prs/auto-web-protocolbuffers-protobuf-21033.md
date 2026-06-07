# protocolbuffers/protobuf #21033 — fix(php): do not throw deprecated warning on field getters for default values

**[View PR on GitHub](https://github.com/protocolbuffers/protobuf/pull/21033)**

| | |
|---|---|
| **Author** | @bshaffer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @esrauchg
> The current behavior of throwing seems obviously bad, but I don't think it makes sense to care if the field is a default value or not in protobuf semantics; is this actually an idiomatic PHP shape of behavior?

### @esrauchg
> I would have expected the WAI behavior to just log an error on deprecated fields that are either get or set, and to not care about the default value and to never throw?

### @bshaffer
> The issue is that this check is performed internally. This is why customers get deprecated warnings in their logs even though they have not used the field.

### @esrauchg
> I don't think we need to hold up the backport here; 'deprecation messages when the application isn't doing anything' is more bad than 'incorrectly not having coverage of getters that happen to be default' is bad.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
