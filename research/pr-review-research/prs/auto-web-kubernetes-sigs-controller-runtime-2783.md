# kubernetes-sigs/controller-runtime #2783 — ⚠️ Source, Event, Predicate, Handler: Add generics support

**[View PR on GitHub](https://github.com/kubernetes-sigs/controller-runtime/pull/2783)**

| | |
|---|---|
| **Author** | @alvaroaleman |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Danil-Grigorev
> It seems to me that having a typed EventHandler here is not as convenient as to have a method which will infer the type of the object.

### @Danil-Grigorev
> There should be an adapter method for EventHandler for a non-generic controller using type specific generic map method...you can't type cast from one generic type to another.

### @alvaroaleman
> Both your and my approach leave the currently-exported interfaces in place...a Source can only support one of the two, because for the go type system those are different types.

### @Danil-Grigorev
> Tried this once again and this approach seems to work: func convert[T any](fn TypedMapFunc[T]) MapFunc...

### @alvaroaleman
> This change does nothing that would keep us from in the future adding such helpers or improving the UX further.

### @sbueringer
> Overall looks good

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
