# php/php-src #13741 — [RFC] Support object types in BCMath

**[View PR on GitHub](https://github.com/php/php-src/pull/13741)**

| | |
|---|---|
| **Author** | @SakiTakamachi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zmitic
> I am really interested if this RFC will allow lazy evaluation... would require something like this: class Number extends \Stringable { public function getValue(): string|int; }

### @SakiTakamachi
> After much discussion, it was decided that this class should be marked final, so it cannot be inherited

### @zmitic
> will you be open to create `NumberInterface` that users could implement? This would open the door to many new things. But by locking users from custom implementations, I think operator overload will never become a thing.

### @Girgias
> Why is `null` accepted here? This doesn't seem to be the case, looking at the signatures?

### @SakiTakamachi
> This is for the same reason that there are problems with operators on GMP objects and null. When merged this, it was intended to match the behavior of regular operators.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
