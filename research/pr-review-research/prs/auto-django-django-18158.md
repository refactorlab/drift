# django/django #18158 — Fixed #35515 -- Added auto-importing to shell command.

**[View PR on GitHub](https://github.com/django/django/pull/18158)**

| | |
|---|---|
| **Author** | @salvo-polizzi |
| **Status** | ✅ merged |
| **Opened** | 2024-05-11 |
| **Repo** | curated review-culture seed |
| **Diff** | +374 / −19 across 10 files |
| **Engagement** | 45 conversation · 151 inline review comments |

## Top review comments (ranked by reactions)

### @sarahboyce — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/django/django/pull/18158#issuecomment-2265029738)

> Maybe we should add it and then if someone is reading the tutorial on 5.2 but has an earlier version of Django installed (for some reason), they have a hint as to why they are getting an error :+1:

### @salvo-polizzi — 1 reactions  
`👍 1`  ·  [link](https://github.com/django/django/pull/18158#issuecomment-2156628988)

> Hi @adamchainz,
> 
> I've just changed the PR title and created a Trac ticket for this new feature. It's great to hear that this functionality is very well appreciated by other Django users and contributors, and I'm glad to contribute to this project. In the next few days, I'll work on writing tests to improve test coverage for methods that run the shell. I'm looking forward to seeing how this will turn out.

### @salvo-polizzi — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/django/django/pull/18158#issuecomment-2262282434)

> Thanks @sarahboyce for the precious review

### @sarahboyce — 1 reactions  
`👍 1`  ·  [link](https://github.com/django/django/pull/18158#issuecomment-2262922656)

> Don't forget to add a release note to Django 5.2 :star:

### @salvo-polizzi — 1 reactions  
`👍 1`  ·  [link](https://github.com/django/django/pull/18158#issuecomment-2265016504)

> > Another thing we need to think about is, should we update the [Django intro tutorial](https://docs.djangoproject.com/en/5.0/intro/tutorial02/#playing-with-the-api) when it is showing using the shell and importing the models (search for `>>> from polls.models import` in the docs) As they don't need to do this importing, we can probably just remove them 🤔 we could add a `versionchanged` note (not sure if that's neccessary) - what do you think?
> 
> I agree on removing the imports from there because it is unnecessary with this new feature. Regarding the `versionchanged` note, I actually don't know 😕. You know better than I do if this would be useful to most of django users or not.

### @adamchainz — 1 reactions  
`👍 1`  ·  [link](https://github.com/django/django/pull/18158#issuecomment-2274363736)

> > If we want to add some utilities by default, which ones do you think are the most useful? Should we discuss this on the forum first and then maybe open a ticket?
> 
> Yeah let’s do this on a forum thread first. Would you mind starting it?
> 
> > I should have made this clear but I had squashed this into a single commit, rebased main, and done minor edits which have been lost (see [7137486](https://github.com/django/django/commit/71374867765ff5d228bdaaf13a06a3c18361d891))
> 
> @salvo-polizzi I guess you used `git push --force` after you made changes locally, which erased Sarah’s work. To avoid this, use the “safe” force push options instead, which I blogged about here: https://adamj.eu/tech/2023/10/31/git-force-push-safely/ .
> 
> I also have a post on squash-rebasing a branch here: https://adamj.eu/tech/2022/03/25/how-to-squash-and-rebase-a-git-branch/ . You’ve added the commit message, which is great, but you should combine all 8 commits into one. To retain the message make sure you use the `s` (`squash`) rebase command for your last commit.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
