# prisma/prisma #29014 — chore: sanitize QPE connection errors

**[View PR on GitHub](https://github.com/prisma/prisma/pull/29014)**

| | |
|---|---|
| **Author** | @jacek-prisma |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @igalklebanov
> Requested clearer documentation about intentional mutation behavior (on `error.ts`) and advised against relying on the original message after calling the function.

### @coderabbitai
> The function rethrowSanitizedError mutates the incoming Error.message to redact connection strings using CONNECTION_STRING_REGEX before rethrowing; add a clear comment above rethrowSanitizedError stating that the original Error object is intentionally mutated

### @coderabbitai
> sanitizeError currently only redacts CONNECTION_STRING_REGEX from Error.message, leaving non-Error throws (e.g., string connection URIs) unsanitized; update sanitizeError to detect string errors and apply replaceAll then return a new Error

### @coderabbitai
> rethrowSanitizedError currently only sanitizes the top-level error, one-level error.cause and AggregateError.errors without traversing deeper cause chains; fix by adding a recursive sanitizer that calls sanitizeError then traverses .cause chains

### @coderabbitai
> factory.create(url) errors are currently unsanitized (thrown before wrapFactory / rethrowSanitizedError can run). This undermines the PR's security objective for 'factory creation' failures

### @coderabbitai
> The wrapper functions (wrapFactory/wrapAdapter/wrapTransaction) lose prototype methods like getConnectionInfo by spreading instances; preserve prototype when creating wrapped objects

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
