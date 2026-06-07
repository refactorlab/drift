# cli/cli #8698 — gh-attestation cmd integration

**[View PR on GitHub](https://github.com/cli/cli/pull/8698)**

| | |
|---|---|
| **Author** | @malancas |
| **Status** | Merged (April 1, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @andyfeller
> Not the end of the world, but there are a lot of places where these digest algorithms are hard coded strings such as Cobra commands and tests.

### @williammartin
> adding a GH signed bundle to the test data so we can ensure we're confident the right verifier is being picked

### @williammartin
> some kind of validation step to the policy option

### @phillmv
> lets hide tuf-root-verify eh?

### @phillmv
> lets ensure the issues...are documented...and at this point we're better off iterating on smaller diffsets!

### @andyfeller
> I think the adoption looks as good as it can possibly be on paper, the real test will be cutting a release and iterating on what is discovered.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
