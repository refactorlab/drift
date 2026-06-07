# jekyll/jekyll #9776 — feat: Allowing post_url tag to receive liquid variables

**[View PR on GitHub](https://github.com/jekyll/jekyll/pull/9776)**

| | |
|---|---|
| **Author** | @jeffque |
| **Status** | ✅ merged |
| **Opened** | 2025-02-15 |
| **Repo importance** | ★51,475 · 10,283 forks · score 96,994 |
| **Diff** | +73 / −12 across 3 files |
| **Engagement** | 16 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @ashmaroli — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/jekyll/jekyll/pull/9776#issuecomment-2898428293)

> Hello @jeffque,
> Thank you for submitting a pull request to enhance our `post_url` Liquid tag.
> 
> I have a couple of misgivings regarding this:
> - Parsing and rendering a Liquid construct is expensive (performance-wise and object-allocations-wise). Ergo this *enhancement* will result in *regression* of existing use-cases in the wild i.e. the new implementation will now parse and render given `tag_markup` regardless of whether the markup is a variable.
> - The new variable-names and private-method-names does not seem very intuitive and hampers code-readability. (Not a major blocker, especially if you are not a native English-speaker. We can deal with this during final rounds of reviews).
> 
> Since the test-suite passes, you should now consider optimizing the implementation especially reduce regressions as much possible.
> 
> ---
> 
> P.S. Personally, I'm not a fan of this syntax (mixing `{{ }}` within `{% %}`), but unfortunately this is the syntax followed by Jekyll's
> `{% include %}` and `{% link %}` tags. So, lets roll as-is.
> Additionally, there had been talks of deprecating this tag in favor of the `link` tag, among the maintainers in the past. Not sure if that idea has been dropped entirely.

### @ashmaroli — 1 reactions  
`🚀 1`  ·  [link](https://github.com/jekyll/jekyll/pull/9776#issuecomment-2900796953)

> Since it is known that Liquid parsing and rendering will have a certain impact on performance, I don't think there is a value in attaching a benchmark script to this pull request. Having it at your end is beneficial during feature development, though. I suggest removing the attached benchmark (note: We squash commits during merge. So, there's no need to rebase this branch.)
> 
> ---
> 
> Moving on, consider the following code in an include_file:
> ```liquid
> {% for entry in site.data.archives %}
>   <a href="{% post_url {{ entry.slug }}.md %}" title="{{ entry.title }}">
>     {{ entry.title }}
>   </a>
> {% endfor %}
> ```
> Lets assume this include_file is used in two different layouts to render a sidebar.
> 
> During the *build process*, Liquid will *parse* the above code just *once* regardless of how many *pages* utilize the two layouts linking the include_file. This means that, in this particular scenario, there will only be a single instance of `Jekyll::Tags::PostUrl` class but, **this one instance** will call upon **it's `render()` method** as many times as *the number of pages dependent* on the above include_file via layouts.
> 
> *(Just an FYI since your current benchmark does not take this scenario into consideration.)*

### @jeffque — 1 reactions  
`👍 1`  ·  [link](https://github.com/jekyll/jekyll/pull/9776#issuecomment-2903021489)

> Without optimizations: 4.310295 seconds
> 
> Brutal!
> 
> I'll add an issue to keep track of the optimization in `{% link %}` tag just to not getting it lost.

### @ashmaroli — 1 reactions  
`🚀 1`  ·  [link](https://github.com/jekyll/jekyll/pull/9776#issuecomment-2903037285)

> Good to know that, @jeffque.
> My example scenario was to give you an idea about probable scope for optimization and fact that Liquid tags are _context-sensitive_; i.e. the rendered output changes (and should change) with respect to given `context`.
> In general, the total build times are very flaky due to various factors out of our control, so take care not to overexert yourselves leading to _micro-optimizations_ (won't matter in the overall build process) and _premature optimizations_.

### @ashmaroli — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/jekyll/jekyll/pull/9776#issuecomment-2911261704)

> @jeffque, the core changes pertaining to your idea look good for the time being. However, there cumulative diff looks a bit too spread out (_Not your fault_).
> I have submitted a pull request (`#9829`) to refactor the existing implementation in the `master` branch. It is a widely-scoped pr and may take some time to be reviewed. (_May ultimately be split into multiple pull requests of narrower scopes_).
> Once those changes land on `master`, the diff here will be reduced (upon resolving conflicts), improving the readability of the changes as a whole.
> 
> Therefore, you may rest assured that this pull request will be merged in due course.

### @ashmaroli — 1 reactions  
`👍 1`  ·  [link](https://github.com/jekyll/jekyll/pull/9776#issuecomment-2940609446)

> Hello @jeffque,
> Your branch has been changed to be simpler.
> (Of the many changes, I removed the function calls to log additional context regarding the Liquid variable markup currently used, in the event of various errors; The additional message doesn't seem helpful).
> 
> Please go through current state of the branch and feel free to leave comments if necessary.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
