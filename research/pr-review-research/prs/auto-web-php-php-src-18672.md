# php/php-src #18672 — Add Uri\WhatWg classes to ext/uri

**[View PR on GitHub](https://github.com/php/php-src/pull/18672)**

| | |
|---|---|
| **Author** | @kocsismate |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @TimWolla
> I think it would be cleaner if the `write_func()` would throw the exception by itself. This gives it best control over the exception data.

### @kocsismate
> I didn't want to throw in the handlers themselves because of the internal API: different kinds of exceptions/errors may be used in different contexts...handlers should be free of any exception throwing, and the caller should decide based on the context what to do with the error.

### @TimWolla
> When internal code throws an exception while an Exception is already active, it will automatically set the `$previous` value...Thus it is super easy to wrap the exception during unserialization.

### @ndossche
> [Suggested allocating the lexbor parser structure as a normal variable instead of a pointer, noting it] doesn't need to be on the heap per se.

### @TimWolla
> There's still some bits that look like unnecessary indirection / premature abstraction to me, but I'm good with merging this...Perhaps it would make sense to document the internal API as 'not yet stable' for the PHP 8.5 cycle.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
