# facebook/react #28491 — Add `React.useActionState`

**[View PR on GitHub](https://github.com/facebook/react/pull/28491)**

| | |
|---|---|
| **Author** | @rickhanlonii |
| **Status** | ✅ merged |
| **Opened** | 2024-03-05 |
| **Repo** | curated review-culture seed |
| **Diff** | +262 / −48 across 18 files |
| **Engagement** | 32 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

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
>   }, [formState, sho … *[truncated]*

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
> Therefore, it seems like it's better to stay with the model where previous state is returned from `useActionState`. That way you can control … *[truncated]*

### @KATT — 6 reactions  
`👍 6`  ·  [link](https://github.com/facebook/react/pull/28491#issuecomment-2015032940)

> Hey there,
> 
> I hope you don't mind me jumping into the conversation.
> 
> I've been catching up the discussion that led to these changes and I'm genuinely excited to see these APIs receiving more attention.
> 
> I've got a few thoughts on how React could take this even further and help developers to create forms that are progressively enhanced rather than (un)gracefully degraded.
> 
> ## Motivation and suggestions
> 
> One of the key advantages, for me, of `useFormState()`/`useActionState()` and `<form action={action}>` is their ability to create isomorphic/universal forms that are progressively enhanced.
> 
> However, the current API lacks some nuance needed for isomorphic forms:
> 
> ### 1. Access to `Payload` for enhanced abstractions
> 
> One challenge is the difficulty in creating abstractions that gracefully degrade due to limited access to `Payload`. In PHP, for example, you have the convenient `$_POST` object for accessing form data anywhere.
> 
> I'd like `Payload` to be as easily accessible as `$_POST` so that all my uncontrolled form inputs could look something like this:
> 
> ```tsx
> <input type="text" name="title" defaultValue={payload?.get('title')} />
> ```
> 
> If I was to make a custom `<Input>`-component that supported this now, I couldn't rely on React giving me access to the payload, without forcing a specific envelope on the server.
> 
> #### Suggestion
> 
> I propose updating the hook to return a tuple *(or object)* with:
> 
> - `dispatch`: the method to call to dispatch the wrapped action
> - `state`: the last state the action returned
> - `payload` (🆕): the last payload sent to the server (`null | Payload`) … *[truncated]*

### @KATT — 3 reactions  
`👍 3`  ·  [link](https://github.com/facebook/react/pull/28491#issuecomment-2015585371)

> > This is indeed what we're planning to do in React 19, but with a few caveats:
> 
> 🥳 . All makes sense.
> 
> Appreciate your responses here. I'll elaborate more on the `Payload` 👇 
> 
> ---
> 
> > Regarding the first point, I'm not sure your Payload proposal makes sense to me. What is the value of Payload after the submission has completed? It sounds like maybe you intend for it to be `null`, but in that case, the `defaultValue` in your example would also be empty, which conflicts with the idea of resetting back to `defaultValue` upon submission.
> 
> Server-side validation errors. Server actions can be completed without the form being "done".
> 
> Right now, any error response would have to return the full payload as well in order not to render with empty inputs.
> 
> I don't see many people doing forms that work nicely without JS without easy access to payload, it adds a quite a bit of grokking to know that you should return "last payload" on your server in order to render the invalid form with the last submission's values.
> 
> It doesn't conflict the resetting proposal if the order of operations is right in the "JS-enabled" perspective:
> 
> 1. Form is submitted / action is dispatched 
> 2. `useActionState()` now is a new tuple/object in `pending` with the new `payload`
> 3. My `<input />` is re-rendered with a new `defaultValue` (nothing happens since updating the `defaultValue` doesn't actually update it)
> 4. Action completes, resets the form to their `defaultValue`s (which is the latest payload since I used `defaultValue={payload?.get('title')}`
> 
> _Might be some nuance there that needs tweaking to align … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
