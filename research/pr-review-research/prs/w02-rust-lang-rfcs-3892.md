# rust-lang/rfcs #3892 — Complex numbers

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3892)**

| | |
|---|---|
| **Author** | @scimind2460 |
| **Status** | ✅ merged (2026-03-18) · 👍148 ❤️79 🎉22 |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Design review argued from *representation* (rectangular vs polar trade-offs), scoped the feature to where it's justified (FFI), and refused an ambiguous type alias. Semantics first, ergonomics second.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@clarfonthey:**
> the canonical a+bi is not actually the best representation of complex numbers in all cases... while a+bi (orthogonal) representation is efficient for addition, r*(iθ).exp() is more efficient for multiplication

**@tgross35:**
> Arguments of complex T where T is float or double are treated as if implemented as: struct complexT { T real; T imag; }; so it makes sense that an interchange type matches that

**@clarfonthey:**
> I think that having extra FFI-compatibility types is reasonable and this shouldn't prevent us from adding std::ffi::Complex which is orthogonal

**@kennytm:**
> If one needs a discussion to determine whether c64 means Complex<f64> or Complex<f32> perhaps it's the best not to introduce such type alias to avoid ambiguity


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
