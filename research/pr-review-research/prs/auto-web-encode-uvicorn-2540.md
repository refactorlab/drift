# encode/uvicorn #2540 — Add `WebSocketsSansIOProtocol`

**[View PR on GitHub](https://github.com/encode/uvicorn/pull/2540)**

| | |
|---|---|
| **Author** | @Kludex |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aaugustin
> This happens when a message is fragmented. See [RFC 6455 section 5.4] for context. In short: the first frame is TEXT or BINARY, every subsequent frame is CONT, the last frame has the FIN bit set.

### @aaugustin
> Default settings lead to high-memory usage with marginal performance benefits e.g. 316KiB RAM per connection instead of 64KiB for an additional 10% compression.

### @aaugustin
> In a normal closing handshake scenario where you generate a `websocket.disconnect` event when you receive a close frame, it looks like this will generate a second event when TCP terminates, which sounds incorrect.

### @aaugustin
> You may want to handle the case when `decode()` raises an exception. In that case, websockets closes the connection with code 1007 (invalid data).

### @aaugustin
> I would suggest that you always do this in `handle_events()` rather than only in `handle_xxx()` methods where you believe websockets sent an automatic response.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
