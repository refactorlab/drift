# reduxjs/redux #4706 — Revamp "Redux Essentials" tutorial to be TS-first and update contents

**[View PR on GitHub](https://github.com/reduxjs/redux/pull/4706)**

| | |
|---|---|
| **Author** | @markerikson |
| **Status** | ✅ merged |
| **Opened** | 2024-05-12 |
| **Repo importance** | ★61,458 · 15,062 forks · score 126,666 |
| **Diff** | +4169 / −1786 across 41 files |
| **Engagement** | 96 conversation · 16 inline review comments |

## Top review comments (ranked by reactions)

### @Dan503 — 3 reactions  
`👍 1 · ❤️ 1 · 🎉 1`  ·  [link](https://github.com/reduxjs/redux/pull/4706#issuecomment-2261571861)

> @markerikson the timing ended up working out ridiculously well... like _insanely_ well...
> 
> 1. I'm in-between projects at work at the moment so my only task is self-directed study
> 2. I chose Redux as one of my study topics because I am using it in a side project and I only knew the basics, I wanted to know it in depth
> 3. The portability bug hadn't been fixed yet so I encountered it when trying to do the tutorial in TS on my own (which lead me to that [original github issue](https://github.com/reduxjs/redux-toolkit/issues/1806#issuecomment-2196574862))
> 4. None of the existing answers were working for me so I created my own solution and posted what I did to help future developers (so if any of the other answers worked for me this feedback wouldn't have happened)
> 6. The documentation for the TS version was already almost complete, just not published yet, allowing me to redo the full tutorial in TS with the correct types info this time
> 7. Since the tutorial was in PR stage and not published yet (and you explicitly asked for feedback) I felt empowered to comment. (If it had already been published I probably wouldn't have said anything)
> 8. Being in-between projects at work gave me the time needed to redo the tutorial and provide feedback and this seems like something important for the betterment of the wider web development community so I set it as a high priority
> 
> So yeah, a lot of converging coincidences to make this thing happen 🤯

### @markerikson — 2 reactions  
`👍 2`  ·  [link](https://github.com/reduxjs/redux/pull/4706#issuecomment-2204861976)

> (btw, _thank you_ for the _very_ thorough review work here! Really appreciate you going through and actually thinking about what's there - very helpful!)

### @markerikson — 1 reactions  
`👍 1`  ·  [link](https://github.com/reduxjs/redux/pull/4706#issuecomment-2198817430)

> @Dan503 yeah, I need to finish preparing the branch. If you go back far enough, there should be a couple of commits labeled "SQUASHME", with the commit adding the store right after that. You'd want to make a new branch off of that commit. 
> 
> On mobile atm, but let me see if I can find the right commit and paste it here.
> 
> **edit** 
> 
> The "revamped" branch is the first attempt I did converting the repo to TS. The actual branch that shows the full steps is https://github.com/reduxjs/redux-essentials-example-app/tree/redux-essentials-ts-checked . 
> 
> You're want to start from here:
> 
> - https://github.com/reduxjs/redux-essentials-example-app/commit/e7ce2fcbb3d90d184613f4cbec64443a14a44551

### @Dan503 — 1 reactions  
`👍 1`  ·  [link](https://github.com/reduxjs/redux/pull/4706#issuecomment-2199153737)

> @markerikson 
> 
> I get your point. At the same time, this seems like a very minimal amount of effort to cater to a larger audience and avoid unnecessary headaches.
> 
> My suggestion is to essentially add one more sentence to this paragraph:
> 
> > Now that we have some posts data in our store, we can create a React component that shows the list of posts. All of the code related to our feed posts feature should go in the `posts` folder, so go ahead and create a new file named `PostsList.tsx` in there.
> 
> The new sentence being:
> "Note that the file has a `tsx` extension instead of `ts` as this file will contain JSX code in it."
> 
> So the full paragraph becomes:
> 
> > Now that we have some posts data in our store, we can create a React component that shows the list of posts. All of the code related to our feed posts feature should go in the `posts` folder, so go ahead and create a new file named `PostsList.tsx` in there. Note that the file has a `tsx` extension instead of `ts` as this file will contain JSX code in it.

### @markerikson — 1 reactions  
`👍 1`  ·  [link](https://github.com/reduxjs/redux/pull/4706#issuecomment-2204775469)

> Yep, that's the _entire_ reason I came up with the whole login feature :)  It's literally just to show off `extraReducers` and handling other actions, as its own concept, and separate from using `extraReducers` to handle thunks.

### @EskiMojo14 — 1 reactions  
`👍 1`  ·  [link](https://github.com/reduxjs/redux/pull/4706#issuecomment-2208661356)

> > This is likely out of scope for this PR...
> > 
> > `createAppAsyncThunk` appears to be able to detect the first generic quite well automatically. If a parameter is needed, the parameter generic type needs to always be explicitly declared. Unfortunately the Parameter generic is the 2nd Generic so to reach it you have to provide the return type first (the 1st Generic).
> > 
> > An example of what I mean:
> > 
> > ```ts
> > // The only reason I am providing Post here is because I need to provide the PostAddNew type for the parameter
> > export const addNewPost = createAppAsyncThunk<Post, PostAddNew>(
> >   'posts/addNewPost',
> >   async (initialPost) => {
> >     // omitted
> >   },
> > )
> > ```
> > 
> > What I would prefer to do:
> > 
> > ```ts
> > // Post is able to be inferred while a type for the parameter is explicitly defined
> > export const addNewPost = createAppAsyncThunk<PostAddNew>(
> >   'posts/addNewPost',
> >   async (initialPost) => {
> >     // omitted
> >   },
> > )
> > ```
> > 
> > It would be good if there was a way to make `createAppAsyncThunk` able to optionally accept only a parameter generic if one is needed.
> 
> ```ts
> export const addNewPost = createAppAsyncThunk(
>   'posts/addNewPost',
>   async (initialPost: PostAddNew) => {
>     // omitted
>   },
> )
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
