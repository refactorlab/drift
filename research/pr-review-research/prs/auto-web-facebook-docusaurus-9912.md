# facebook/docusaurus #9912 — feat(blog): add LastUpdateAuthor & LastUpdateTime

**[View PR on GitHub](https://github.com/facebook/docusaurus/pull/9912)**

| | |
|---|---|
| **Author** | @OzakIOne |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @slorber
> Looks like a good start 👍 We still need to: refactor, share code; add tests; implement a uniform footer design; support structured data

### @slorber
> I know this is the historical message, but honestly, I doubt users will understand it 😅 Not sure mentioning `FileChange` is super useful

### @slorber
> I think you mislead blog post authors and last update author: those are different concepts... Only the last update author is just a string

### @slorber
> The message doesn't have to explain the types IMHO, just mention that the overall object shape is wrong and valid attribute names.

### @johnnyreilly
> Left review comments on LastUpdated component implementation regarding design choices

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
