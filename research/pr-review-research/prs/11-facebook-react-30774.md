# facebook/react #30774 — feat(eslint-plugin-react-hooks): support flat config

**[View PR on GitHub](https://github.com/facebook/react/pull/30774)**

| | |
|---|---|
| **Author** | @michaelfaith |
| **Status** | ✅ merged |
| **Opened** | 2024-08-21 |
| **Diff** | +82 / −11 across 2 files |
| **Engagement** | 54 conversation comments · 7 inline review comments |

## Why this PR is notable

Converting the `eslint-plugin-react-hooks` to flat config + TypeScript. `michaelfaith` posts a **summary that consolidates the entire discussion** before the API converges; `poteto` closes the loop with a published RC and credits the contributor.

## 🧠 The lesson for reviewers

> A comment that **summarizes a long thread** into a decision is one of the highest-leverage things a reviewer can write. Then close the loop with a shipped artifact and credit.

## How the author framed it (PR description excerpt)

> I also updated the README to include usage examples.
> 
> Example usage:
> ```js
> import reactHooks from 'eslint-plugin-react-hooks';
> 
> export default [
>  {
>     files: ['**/*.{js,jsx}'],
>     languageOptions: {
>       ecmaVersion: 2020,
>       globals: globals.browser,
>       parserOptions: {
>         ecmaVersion: 'latest',
>         ecmaFeatures: {jsx: true},
>         sourceType: 'module',
>       },
>     },
>     settings: {react: {version: '18.3'}},
>     ...reactHooks.configs['recommended-latest'],
>   },
> ];
> ```
> 
> Closes #28313

## Highest-signal comments (ranked by reactions)

### @poteto — 23 reactions  
`❤️ 9 · 🎉 12 · 🚀 2`  ·  [link](https://github.com/facebook/react/pull/30774#issuecomment-2689106788)

> I just published https://www.npmjs.com/package/eslint-plugin-react-hooks/v/5.2.0-rc.1 which contains this fix and the conversion of the plugin to TS. I will promote it to the `latest` tag shortly.
> 
> Huge thanks to @michaelfaith for working on these improvements to the plugin!


### @poteto — 21 reactions  
`❤️ 15 · 🎉 6`  ·  [link](https://github.com/facebook/react/pull/30774#issuecomment-2597127299)

> Thanks everyone for the patience and also to @michaelfaith for seeing this through!


### @michaelfaith — 17 reactions  
`👍 9 · ❤️ 8`  ·  [link](https://github.com/facebook/react/pull/30774#issuecomment-2427001763)

> Updated to have everything under `configs`.
> 
> @eps1lon, to summarize all of the discussion:
> 
> - The TypeScript types built into `eslint` tend to favor all configs (both flat and non-flat) to be attached to the same `configs` object, which was different from what I originally had done (using a separate `flatConfigs` export).  This could create some rough edges for people with TypeScript-based configs (though it wouldn't really be an issue if this package had its own types).
> - @nzakas clarified that the official recommendation from the eslint team is to put new flat configs on the same `configs` object as the original ones.  
> - He went further to say that they're recommending the new flat configs _not_ have any qualifiers like `-flat` as part of the name.  To rename existing configs with a `-legacy` suffix, and have the new flat configs take the old name (e.g. just `recommended`)
> - That last point is the only one I didn't observe as part of my revision, since it would represent a breaking change. And with it being on the heals of the 5.0 release, I didn't think that you'd want to do another major version bump in such quick succession.  
> 
> I introduced two new configs to the `configs` export:
> - `'recommended-legacy'` - the original `'recommended'` config, for use with og rc-based configs
> - `'recommended-latest'` - the new "flat" config.  I was going back and forth between `'recommended-flat'` and this, but landed on this, since 'latest' feels like a better parallel to 'legacy' (and they seem to be wanting to avoid the "flat" nomenclature), but also happy to change it to something else.  I left 'recommended' to be an alias for 'recommended-legacy'  so that it isn't introducing a …​ *[truncated]*


### @poteto — 13 reactions  
`👍 4 · ❤️ 7 · 🎉 2`  ·  [link](https://github.com/facebook/react/pull/30774#issuecomment-2660115094)

> @Aluisio nothing concrete yet, but I'm hoping we can cut a next release after #32240 lands. Hopefully by next week.


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
