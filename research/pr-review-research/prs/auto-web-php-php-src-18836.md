# php/php-src #18836 — Add the Uri\Rfc3986\Uri class to ext/uri without wither support

**[View PR on GitHub](https://github.com/php/php-src/pull/18836)**

| | |
|---|---|
| **Author** | @kocsismate |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @TimWolla
> I think this should rather be called `ext/uri/parser_rfc3986.c` and `php_lexbor.c` would be `ext/uri/parser_whatwg.c`... `php_uriparser.c` name is confusing

### @TimWolla
> It's being stored in a `zend_long`, so should return a `zend_long`

### @TimWolla
> The leak should be fixed, though

### @ndossche
> [Moving `PHP_METHOD` implementations into matching source files would keep `php_uri.c` slim rather than consolidating everything centrally.]

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
