# BuilderIO/qwik #6752 — feat: add `valibot$` validator and fix types of `zod$` implementation

**[View PR on GitHub](https://github.com/BuilderIO/qwik/pull/6752)**

| | |
|---|---|
| **Author** | @fabian-hiller |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wmertens
> I think we can merge this as a new feature provided we're sure that the error output will not change later. Then we'd have to have some tests that verify the error shape.

### @wmertens
> I think it straightforward enough to merge asap, it could be part of 1.8.0. Documentation would be great, please add some tests though...as well as real tests for the error shape.

### @tzdesign
> @fabian-hiller can you fix the key thing, I would than check it out in our large code base again.

### @fabian-hiller
> I think it is best if we mark the new `valibot$` adapter as 'alpha' and merge it as is...If we were to start rewriting everything to support the default error format of the validator being used, this PR would probably never get merged.

### @brandonpittman
> This is working really well. When's it going to be out of _experimental_?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
