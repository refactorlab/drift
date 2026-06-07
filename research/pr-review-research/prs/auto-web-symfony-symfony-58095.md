# symfony/symfony #58095 — [Security] Implement stateless headers/cookies-based CSRF protection

**[View PR on GitHub](https://github.com/symfony/symfony/pull/58095)**

| | |
|---|---|
| **Author** | @nicolas-grekas |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jderusse
> AWASP discourage using this pattern and recommands using a hash/crypted value coupled to the session (or JWT lifetime) instead

### @wouterj
> If I'm correct, the stance of Symfony 7.2 would be: verify origin and do not use tokens for CSRF protection. Then, for cases where origin headers might not be set (e.g. corporate environments), we fallback to CSRF token protection using a modified double-submit pattern.

### @wouterj
> by generating the CSRF token and creating the cookie in the JS code moves a security-critical part of the double-submit flow to the application code.

### @stof
> One argument for renaming: it will avoid getting more reports in the future from people telling us that OWASP discourages the double submit pattern, because they miss that they only discourage **naive** double-submit.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
