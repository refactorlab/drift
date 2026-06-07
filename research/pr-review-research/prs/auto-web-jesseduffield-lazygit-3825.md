# jesseduffield/lazygit #3825 — Support hyperlinks from pagers

**[View PR on GitHub](https://github.com/jesseduffield/lazygit/pull/3825)**

| | |
|---|---|
| **Author** | @stefanhaller |
| **Status** | Merged (August 24, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jesseduffield
> I agree with @dandavison on the underlines... They look really noisy, and I find them harder to mentally parse than their non-underlined counterparts.

### @dandavison
> What do you think about only showing the underline on-hover? I think it would look cleaner that way, and is what people are familiar with from web browsers.

### @stefanhaller
> I really like them being shown always, not only on hover. Curious what @jesseduffield thinks.

### @dandavison
> Users only have to go through that 'discovery phase' once; they'll soon discover the links due to the on-hover underline. This is similar to in a web browser.

### @jesseduffield
> I don't want a front-loaded benefit of discoverability to come at the ongoing cost of reduced legibility... [@stefanhaller] says it's not easy to implement so I'm happy for us to just raise an issue.

### @stefanhaller
> Not really [a configuration option]. It would be a lot of work to implement underlining on hover, and I don't think spending that amount of effort is justified if there's only one user who doesn't want to see them.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
