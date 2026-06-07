# slint-ui/slint #10857 — Respect the locale's decimal separator in string to float and float to string

**[View PR on GitHub](https://github.com/slint-ui/slint/pull/10857)**

| | |
|---|---|
| **Author** | @tronical |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @LeonMatthes
> What I'm worried about is that this is somewhat of a breaking change. Before, if you had a TextInput that accepted decimal input, you could rely on the fact that it would correctly parse into an f32 or f64. But now that is no longer the case.

### @LeonMatthes
> One good point that @tronical brought up is that modifying the string/float conversion in Slint would break existing backend code that does the string-to-float conversion... Overall I'm in favor of experimenting on the string float conversion, but that might be good to do in a separate PR.

### @ogoffart
> Imho at the same time, we should adjust the number to string conversion and string to number.

### @tronical
> So if the two of you are in favour, then I'll make this PR change the meaning of `decimal` to accept `.` and the locale's separator, change to-string to generate the locale separator, and make to-float accept `.` and the decimal separator.

### @ogoffart
> I don't think we should have `DecimalLocalized`. The correct behavior is to always localize, if the app is translated. And we should also localize the float -> string conversion.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
