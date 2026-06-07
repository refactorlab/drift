# spring-projects/spring-boot #49571 — Enable ansi support by default on Windows 11+

**[View PR on GitHub](https://github.com/spring-projects/spring-boot/pull/49571)**

| | |
|---|---|
| **Author** | @plumstone |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @philwebb
> We've had a similar request in the past and found ANSI support in Windows quite hard to get working consistently... If we do consider this again, I think it should be for Windows 11+ only.

### @wilkinsona
> I think shelling out like this might be a deal-breaker for me. Is there really no other way to detect Windows 11?

### @wilkinsona
> Looking at [JDK-8274840], I think we could use the `os.name` system property looking for a value of `Windows 11` instead.

### @wilkinsona
> I think we should just look for the string `Windows 11` without any parsing... I think that's preferable to the proposed parsing that adds quite a bit of complexity for no current benefit.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
