# kata-containers/kata-containers #8870 — port attestation agent from CCv0 branch to main branch

**[View PR on GitHub](https://github.com/kata-containers/kata-containers/pull/8870)**

| | |
|---|---|
| **Author** | @LindaYu17 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stevenhorsman
> The other thing missing from this PR is the integration tests based on the acceptance criteria in #8123 and the work done in kata-containers/tests#5754 into the kata-containers repo.

### @fitzthum
> First of all, I would remove platform specific code from this PR...I would simplify things by just focusing on the non-tee case first (with the sample attester).

### @Xynnn007
> There are some changes happening after v0.8.0...we need to do some small change. I don't know if the target of merge-to-main is 0.8.0, or does it also include some changes that occurred after 0.8.0?

### @fitzthum
> What is the use case for not having the CDH enabled? Maybe we should just have one feature for the AA and CDH both.

### @Xynnn007
> Should we raise an error for this function if CDH fails to run?

### @stevenhorsman
> I think we are at risk of over optimising this and heading towards more service management features...maybe we leave it with the logging for now and re-visit this later?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
