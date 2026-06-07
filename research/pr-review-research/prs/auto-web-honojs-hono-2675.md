# honojs/hono #2675 — feat(utils/body): add dot notation support for `parseBody`

**[View PR on GitHub](https://github.com/honojs/hono/pull/2675)**

| | |
|---|---|
| **Author** | @fzn0x |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @usualoma
> Objects containing arbitrary data should be initialized using `Object.create(null)`

(To prevent prototype-pollution vulnerabilities and property conflicts.)

### @usualoma
> I think it would be better to prevent the File object's properties from being updated

### @MathurAditya724
> I believe `handleNestedValues` and `handleParsingAllValues` might be clashing

(Raised when both dot notation and array parsing are enabled simultaneously.)

### @yusukebe
> The following test does not pass now. But is this expected?

(Regarding multiple form-field appends with identical dot-notation keys not producing arrays as intended.)

### @iveshenry18
> I'm suggesting a utility that can take a nested object and parse it into a flat object with dot-notation keys

(For client-side symmetry with the server-side parsing.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
