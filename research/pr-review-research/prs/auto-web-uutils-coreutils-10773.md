# uutils/coreutils #10773 — coreutils: Protect against env -a for security

**[View PR on GitHub](https://github.com/uutils/coreutils/pull/10773)**

| | |
|---|---|
| **Author** | @oech3 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ChrisDryden
> I think it would make sense for this code to go into the validation.rs file instead of in the main.rs, then you don't have to worry about importing libc. It would be good to have an additional integration test that shows the env -a working

### @Ecordonnier
> Btw, this is not only a security fix. For instance there is a bug in Cursor which is packaged using AppImage: The integrated terminal of cursor starts uutils-coreutils with a wrong value of argv[0].

### @Ecordonnier
> I think we can mix if there is a functional need for it. Maybe we should add a test verifying that the program name can't be spoofed using LD_PRELOAD and intercepting libc getauxval().

### @oech3
> I think AppImage should support AT_EXECFN instead, but fixing it at here is not too bad.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
