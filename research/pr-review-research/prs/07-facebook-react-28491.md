# facebook/react #28491 — Add `React.useActionState`

**[View PR on GitHub](https://github.com/facebook/react/pull/28491)**

| | |
|---|---|
| **Author** | @rickhanlonii |
| **Status** | ✅ merged |
| **Opened** | 2024-03-05 |
| **Diff** | +262 / −48 across 18 files |
| **Engagement** | 32 conversation comments · 8 inline review comments |

## Why this PR is notable

Adding `useActionState`. `acdlite` (React core) reasons through `KATT`'s 'align with native form behavior' point about resetting inputs to `defaultValue`; `eps1lon` flags the downstream **Next.js version dependency**; `rwieruch` brings learnability/confusion feedback.

## 🧠 The lesson for reviewers

> Great review threads connect a change to **web-platform semantics**, **downstream releases**, and **how it will be taught** — three lenses an author rarely holds all at once.

## How the author framed it (PR description excerpt)

> ## Overview
> 
> _Depends on https://github.com/facebook/react/pull/28514_
> 
> This PR adds a new React hook called `useActionState` to replace and improve the ReactDOM `useFormState` hook.
> 
> ## Motivation
> 
> This hook intends to fix some of the confusion and limitations of the `useFormState` hook. 
> 
> The `useFormState` hook is only exported from the `ReactDOM` package and implies that it is used only for the state of `<form>` actions, similar to `useFormStatus` (which is only for `<form>` element status). This leads to understandable confusion about why `useFormState` does not provide a `pending` state value like `useFormStatus` does.
> 
> The key insight is that the `useFormState` hook does not actually return the state of any particular form at all. Instead, it returns the state of the _action_ passed to the hook, wrapping it and returning a trackable action to add to a form, and returning the last returned value of the action given. In fact, `useFormState` doesn't need to be used in a `<form>` at all.
> 
> Thus, adding a `pending` value to `useFormState` as-is would thus be confusing because it would only return the pending state of the _action_ given, not the `<form>` the action is passed to. Even if we wanted to tie them together, the returned `action` can be passed to multiple forms, creating confusing and conflicting pending states during multiple form submissions.
> 
> Additionally, since the action is not related to any particular `<form>`, the hook can be used in any renderer - not only `react-dom`. For example, React Native could use the hook to wrap an action, pass it to a component that will unwrap it, and return the form result state and pending state. It's renderer agnostic.
> 
> To …​ *[truncated]*

## Highest-signal comments (ranked by reactions)

### @rwieruch — 8 reactions  
`👍 1 · ❤️ 3 · 👀 4`  ·  [link](https://github.com/facebook/react/pull/28491#issuecomment-1994282084)

> Great PR and great to see how fast the team responds to the feedback! Leaving just my 2 cents here from an educational perspective:
> 
> I ran into the same confusion when I wrote my blog post about Forms in Next. Now if I understand this PR correctly, `useFormState` will go away in favor or `useActionState`, but `useFormStatus` will stay around as a more fine-grained primitive (where I didn't have any usage yet, but probably more interesting for library/framework authors).
> 
> Now I have a kinda related question. In my [article](https://www.robinwieruch.de/next-forms/#toast-message-with-server-actions-in-next), I wanted to show how to trigger a reactive toast message once an action returns its response. But I had no indicator for the new `formState`, therefore I had to return a `timestamp` (read: `timestamp: Date.now()`) from the action as `formState`, so that I could reactively show a toast message in a custom hook:
> 
> ```
> import { useRef, useEffect } from 'react';
> import { toast } from 'react-hot-toast';
> 
> type FormState = {
>   message: string;
>   fieldErrors: Record<string, string[] | undefined>;
>   timestamp: number;
> };
> 
> const useToastMessage = (formState: FormState) => {
>   const prevTimestamp = useRef(formState.timestamp);
> 
>   const showToast =
>     formState.message &&
>     formState.timestamp !== prevTimestamp.current;
> 
>   useEffect(() => {
>     if (showToast) {
>       if (formState.status === 'ERROR') {
>         toast.error(formState.message);
>       } else {
>         toast.success(formState.message);
>       }
> 
>       prevTimestamp.current = formState.timestamp;
>     }
>   }, [formState, showToast]);
> };
> 
> export { useToastMessage };
> ```
> 
> Since the returned `message` could be the same (e.g. …​ *[truncated]*


### @eps1lon — 8 reactions  
`👍 6 · ❤️ 1 · 👀 1`  ·  [link](https://github.com/facebook/react/pull/28491#issuecomment-2075431638)

> Next.js hasn't caught up with the React version that supports this hook. You need to wait for a release of https://github.com/vercel/next.js/pull/64798 to use this hook.


### @acdlite — 7 reactions  
`👍 7`  ·  [link](https://github.com/facebook/react/pull/28491#issuecomment-2015283772)

> @KATT 
> 
> Regarding the second point:
> 
> > I suggest aligning React's behavior with JS to mimic the web's default behavior without JS. This means putting the form inputs back to their defaultValue when submitted.
> 
> This is indeed what we're planning to do in React 19, but with a few caveats:
> 
> - We only reset if a function is passed to `action`.
> - Only uncontrolled form inputs will be reset.
> - The form is reset to `defaultValue` only once the action is completed. That way you can update `defaultValue` to a new value from the server right before the reset happens. (This is different from how regular `form.reset()` works because it's asynchronous.)
> - To allow you to implement the same behavior manually, we'll provide a `resetForm` import from `react-dom` that works the same way: reset the form the to `defaultValue` once the current action/transition has completed.
> 
> ---
> 
> Regarding the first point, I'm not sure your Payload proposal makes sense to me. What is the value of Payload after the submission has completed? It sounds like maybe you intend for it to be `null`, but in that case, the `defaultValue` in your example would also be empty, which conflicts with the idea of resetting back to `defaultValue` upon submission.


### @sebmarkbage — 7 reactions  
`👍 2 · ❤️ 2 · 👀 3`  ·  [link](https://github.com/facebook/react/pull/28491#issuecomment-2046154917)

> @KATT Your proposal/argument was compelling. We've spent some time evaluating a variant of your proposal (useFormStatus would have previous payload), but are currently leaning towards not adding it. Mainly due to hydration.
> 
> When you use the sent FormData directly to represent the "current" state of a form, there's no way to reset the form or control a field. E.g. filtering out invalid characters or upper case the field from the action. If that was ok, we could do something even better and just automatically set the value of a form field to the last set. Since it's not ok, that's why it's not a sufficient solution, you may need to move the source of truth into the state later on once you need to be able to control it from the action. That doesn't dismiss that you could start with the last-sent payload and then later upgrade to putting it inside useActionState as need arrises.
> 
> However, the main problem with surfacing the last sent payload is that we would still need to serialize it into the HTML for hydration. Since the current model is that even after submitting an MPA form, we can still hydrate the second attempt. It doesn't stay in no-JS land afterwards. So it wouldn't be better than the `useActionState` option and you still might need the `useActionState` option later when the need arrises. In that case we'd have to keep serializing the whole form - including files potentially - for hydration purposes in case you end up using it.
> 
> Therefore, it seems like it's better to stay with the model where previous state is returned from `useActionState`. That way you can control it and filter out anything that's not needed (such as Blobs).
> 
> There are a couple of things we can d …​ *[truncated]*


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
