# rust-lang/rust #69864 — unix: Extend UnixStream and UnixDatagram to send and receive file descriptors

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/69864)**

| | |
|---|---|
| **Author** | @LinkTed |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @joshtriplett
> I think these functions all need to take `&mut self`, not just `&self`. You shouldn't be able to read or write a non-mutable socket.

### @joshtriplett
> Interesting! No, I stand corrected, leave them as `&self`

### @the8472
> I think for datagrams this is not the right approach since you can only receive a datagram once and then if you want to inspect its headers you need to do this on the headers linked to this datagram.

### @the8472
> It would be better to create some opaque headers struct which can then be queried for additional information. I.e. a more general `recv_with_headers()`

### @the8472
> The cmsg pattern is to let the caller allocate the storage...The recv method writes the raw data into the pre-allocated argument and then the caller can again extract the data into another preallocated buffer.

### @joshtriplett
> However, please don't submit a patch series which introduces and subsequently fixes bugs within the same series. Your patch series should consist of a set of commits that each individually pass tests.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
