# symfony/symfony #58095 — [Security] Implement stateless headers/cookies-based CSRF protection

**[View PR on GitHub](https://github.com/symfony/symfony/pull/58095)**

| | |
|---|---|
| **Author** | @nicolas-grekas |
| **Status** | ✅ merged |
| **Opened** | 2024-08-26 |
| **Repo** | curated review-culture seed |
| **Diff** | +608 / −10 across 13 files |
| **Engagement** | 47 conversation · 90 inline review comments |

## Top review comments (ranked by reactions)

### @nicolas-grekas — 5 reactions  
`👍 5`  ·  [link](https://github.com/symfony/symfony/pull/58095#issuecomment-2354739639)

> Another benefit of this PR: since it's stateless, end users won't loose their content if they take time to submit a form: even if the session is destroyed while they populate their form, remember-me will reconnect them and the form will be accepted.

### @nicolas-grekas — 3 reactions  
`🎉 2 · 👀 1`  ·  [link](https://github.com/symfony/symfony/pull/58095#issuecomment-2348351600)

> I reworked the integration of the new CSRF token manager with the framework:
> 
> Instead of replacing the existing one, we now decorate it, and we ask users to list the token-ids that should be managed using double-submit. This makes things way easier to integrate since we're back to one single manager.
> 
> Here is the config I used on my test app to benefit from double-submit validation for all form submissions but also for form-login authentications and for logouts:
> 
> ```yaml
> framework:
>     form: { csrf_protection: { token_id: submit } }
>     csrf_protection:
>         double_submit_token_ids: [submit, authenticate, logout]
> ```

### @stof — 2 reactions  
`👍 2`  ·  [link](https://github.com/symfony/symfony/pull/58095#issuecomment-2397199820)

> One argument for renaming: it will avoid getting more reports in the future from people telling us that OWASP discourages the double submit pattern, because they miss that they only discourage **naive** double-submit.

### @nicolas-grekas — 1 reactions  
`👍 1`  ·  [link](https://github.com/symfony/symfony/pull/58095#issuecomment-2312706762)

> For additional background: the OWASP page links to https://owasp.org/www-chapter-london/assets/slides/David_Johansson-Double_Defeat_of_Double-Submit_Cookie.pdf to give more insights about vulnerabilities with the "naive double-submit".
> 
> I read that doc too, and they don't apply to this PR:
> - MITM are ruled out by HTTPS nowadays (and no CSRF techniques can resist to MITM anyway)
> - HTTPS is enforced for cookies by the `__Host-` prefix, which prevents overriding them from HTTP
> - overriding the cookie isn't enough since the double-submit happens *via a custom header* (which is listed as a valid CSRF-protection on that PDF and on the OWASP page)
> - the Origin header is checked also when available
> 
> Binding CSRF tokens to any server-side state is ruling out statelessness/cacheability of the strategy so I'm not looking for anything hashed/signed/etc.

### @alexander-schranz — 1 reactions  
`👍 1`  ·  [link](https://github.com/symfony/symfony/pull/58095#issuecomment-2315024841)

> Want to mention that we in Sulu Form Bundle are using a custom csrf token manager which does not generate a Token when rendering our `Dynamic Form` disabled csrf token manager, may a strange name it just disables generating (avoid session start) but still supports validating for the submit part:
> 
>  - https://github.com/sulu/SuluFormBundle/blob/12d2df14f2af7ea2ec3e0c3cf1f1638c71325b20/Csrf/DisabledCsrfTokenManager.php#L58 
>  
> So th emain rendering does return a empty field and JS can via `render_js` / `render_hinclude` or via a custom stimulus or JS component which will then generate the token via a Endpoint with Symfony default token manager:
> 
>  - https://github.com/sulu/SuluFormBundle/blob/12d2df14f2af7ea2ec3e0c3cf1f1638c71325b20/Controller/FormTokenController.php#L34
> 
> Some older examples can be found here: https://github.com/sulu/SuluFormBundle/blob/2.5/Resources/doc/csrf.md#a-ajax-with-jquery.
>  
> So generating the CSRF token is out of the main rendering and the main site is still being cached.
> 
> Previously we even did do it in via `render_esi` but ESI does not support adding `headers` specially in case of varnish, and so a session (which is cookie based) can not be started. So it was important that we moved that part to JS. Also best as bots to then not generate useless sessions.

### @nicolas-grekas — 1 reactions  
`👍 1`  ·  [link](https://github.com/symfony/symfony/pull/58095#issuecomment-2323411087)

> @alquerci I answered this question before, see 
> https://github.com/symfony/symfony/pull/58095#issuecomment-2312706762


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
