# ocornut/imgui #7954 — Fix C++26 invalid enum operation

**[View PR on GitHub](https://github.com/ocornut/imgui/pull/7954)**

| | |
|---|---|
| **Author** | @CrackedMatter |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ocornut
> Thank you. I ought to add this test to my local build scripts.

### @ocornut
> FYI I tried the command-line from #7383 (comment) and even with this couldn't trigger the warning.

### @nicolasnoble
> Clang-18 is available on Ubuntu 24.04, and I can see clang-19 on debian sid. It might be a good idea to bump and/or add ubuntu 24.04 to the CI

### @ocornut
> I upgraded to Ubuntu 24.04 now but it seems GCC there supports up to C++20. I added a C++20 build to Linux GCC and MacOS Clang, and a C++26 to Linux Clang.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
