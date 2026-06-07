# rails/rails #55334 — Structured Event Reporting in Rails

**[View PR on GitHub](https://github.com/rails/rails/pull/55334)**

| | |
|---|---|
| **Author** | @adrianna-chang-shopify |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bdewater-thatch
> I understand the need for flexibility but the bolded part reads like configuration over convention 😅 I expected a default formatter (that could be disabled, if desired) at least.

### @zzak
> I put together some ideas...based on something like `ActiveSupport::Messages::SerializerWithFallback.[](format)`

### @skipkayhil
> I think it would be best if we move the require up to configuration time...users figure out they may be missing a gem during boot instead of randomly during runtime.

### @bquorning
> is 'emit' the correct word to use here? I would expect an `#emit` method to be the one emitting the event to notify a subscriber.

### @rafaelfranca
> Missing documentation for this config in the configuring guide.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
