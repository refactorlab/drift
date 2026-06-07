# pmndrs/zustand #2580 — fix(types)!: require complete state if `setState`'s `replace` flag is set

**[View PR on GitHub](https://github.com/pmndrs/zustand/pull/2580)**

| | |
|---|---|
| **Author** | @Yonom |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @charkour
> I believe this is expected behavior. See 'overwriting state' on the Readme. Thank you

(Later:)
> However, I do advocate for this change.

### @dai-shi
> which causes the default to suggest replace: true, since it has a shorter definition. Oh, that sounds pretty bad.

### @devanshj
> This PR's approach would break things like `let foo = Math.random() > 0.5 ? true : false; store.setState({ bears: 5 }, foo) // error`

### @Yonom
> I assume the distribution of real world uses of each of these cases to be: 1. 95% 2. 5% 3. 0.1% 4. 0%. Case 3 is unfortunate. Breaking case 3 to catch errors in case 2 is worth it.

### @dai-shi
> Nothing is ideal. How is it [worked around]? I think it should be documented somewhere in ./docs as well as the migration guide.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
