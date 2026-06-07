# llvm/llvm-project #102323 — [llvm] Add a simple Telemetry framework

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/102323)**

| | |
|---|---|
| **Author** | @oontvoo |
| **Status** | Merged (later reverted due to build failures) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jh7370
> As noted elsewhere, please redo all your variable and function names to conform with the coding standards. It's surprisingly distracting having them wrong!

### @jh7370
> Not sure it's a well-known word though, so it doesn't really help convey meaning though, which is the key thing.

### @labath
> I probably wouldn't bother checking that its serializable and just let the user get a compile error on the `write(key, mapped_type())` call

### @jh7370
> I see this class as being the thing that a) receives the user-created configuration data, b) receives the telemetry data, c) does things related to setup and teardown of the telemetry system.

### @labath
> Question (for both of you) do you want begin/end object to be public, or should it be a private interface, accessible only through the map wrapper?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
