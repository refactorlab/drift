# rust-lang/rust #43076 — Generator support

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/43076)**

| | |
|---|---|
| **Author** | @Zoxc |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nikomatsakis
> I remain fairly convinced we should remove them [gen arg syntax], but if for some reason that is infeasible, I'd like to understand that better...the more we can do to prune it down (and then add things in separately later) the better, since those additions can then get reviewed in more depth.

### @eddyb
> I am also against the concept as a whole - it's there to get rid of thread-local state but I do not think it's a satisfactory solution.

### @nikomatsakis
> it seems like neither iterators nor futures require the ability to provide 'feedback' during execution, so I would personally be happy to 'defer' that part for later PRs.

### @nikomatsakis
> It's worth adding a comment -- what is an `Option<GeneratorClause>`? (Also, I wonder if we should convert this to a struct variant at some point.)

### @alexcrichton
> At this point the commit history is basically an accurate reflection of this history of this feature...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
