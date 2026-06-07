# bevyengine/bevy #11426 — Computed State & Sub States

**[View PR on GitHub](https://github.com/bevyengine/bevy/pull/11426)**

| | |
|---|---|
| **Author** | @lee-orr |
| **Status** | ✅ merged |
| **Opened** | 2024-01-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +2540 / −131 across 13 files |
| **Engagement** | 44 conversation · 142 inline review comments |

## Top review comments (ranked by reactions)

### @MiniaczQ — 3 reactions  
`👍 3`  ·  [link](https://github.com/bevyengine/bevy/pull/11426#issuecomment-1913384259)

> I too think spamming in here is not helpful, the PR is pretty complete as is and the solution can be modified later if necessary. If you want to continue the discussion, we do have a [discord thread related to this PR](https://discord.com/channels/691052431525675048/1200493505664000050).

### @CooCooCaCha — 3 reactions  
`👍 3`  ·  [link](https://github.com/bevyengine/bevy/pull/11426#issuecomment-1919446439)

> I like this and would find this super helpful in my game. 
> 
> I'm not suggesting the title be changed, but this could also be referred to as *reactive* state, since you're basically computing a state reactivity graph. In the future, I wonder if a similar system could be implemented using states as entities and bevy reactivity.
> 
> Anyways, I've encountered a similar scenario to what @lee-orr described where I want to start a game session by inserting game state. Personally, I don't think optional states are an advanced feature. In-fact, I think they're likely to become common as people develop more production-quality apps in Bevy with various modes, mini-games, and situational state. So I'm a fan of optional state being a built-in feature and I don't think a rust game engine should shy away from Option.

### @alice-i-cecile — 2 reactions  
`👍 2`  ·  [link](https://github.com/bevyengine/bevy/pull/11426#issuecomment-1981180439)

> For context, as a driver of "we should remove the state stack", the motivations were:
> 
> - it used looping run criteria, which were a general disaster for complexity and teachability
> - it didn't have compelling use cases: it was just cribbed from Amethyst's implementation
> - it was very complex to maintain, with both opaque internals and complex interactions with every other piece of our scheduling 
> - it made it hard to reason about the current state of the application
> - it was an attempt to work around problems that are better handled by more powerful reactive graph tools
> 
> Substates and some form of "state pattern matching" are much more directly relevant: modelling things like "game modes" or "nested menus" comes up pretty quickly as the app grows. I'm still nervous that this isn't the simplest / clearest / best solution to these ideas, but I don't immediately have a counterproposal and I think the problem space is important.

### @lee-orr — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/bevyengine/bevy/pull/11426#issuecomment-2002884786)

> @james7132  @alice-i-cecile @MiniaczQ - Here is an attempt at simplifying the UX further, at the expense of some more macro complexity: https://github.com/lee-orr/bevy/pull/7
> 
> The main idea is that instead of manually implementing ComputedStates or SubStates, you always rely on the States derive macro.
> 
> For a sub state, you'd use it in one of the following ways:
> ```rust
> #[derive(States, ....)]
> #[substate(AppState = AppState::InGame)]
> enum PauseState {
>  #[default]
>  Running,
>  Paused
> }
> ```
> or
> ```rust
> #[derive(States, ...)]
> #[substate(AppState, |app_state| match app_state {
>   Some(AppState::InGame) | Some(AppState::InMiniGame) => Some(PauseState::Running)
>   _ => None
> }
> enum PauseState {
>   Running
>   Paused
> }
> ```
> 
> Similarly, ComputedStates can be created with the following:
> ```rust
> #[derive(States, ...)]
> #[computed(AppState, |app_state| match app_state {
>   Some(AppState::InGame { level }) => Some(if level < 5 { InGame::LowLevel } else { InGame::HighLevel })
> });
> enum InGame {
>   LowLevel,
>   HighLevel
> }
> ```
> 
> If that feels like a good direction for y'all - I'll merge it into this PR and we can get this merged from there. (I'll fix details in the CI and stuff once it's in this branch)

### @lee-orr — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/11426#issuecomment-1901126321)

> @alice-i-cecile & @MiniaczQ - just wanted to ping you for this new PR, as promised a few weeks ago here: https://github.com/bevyengine/bevy/pull/10088#issuecomment-1871655690

### @marcelchampagne — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/11426#issuecomment-1913275021)

> My biggest problem with the implementation of ComputedStates is as follows. Keep in mind this is a user-facing perspective and I don't have the full context on the actual implementation of state, so take everything I say with a grain of salt.
> 
> I'm unsold on using 'None' to represent an active variant of state. The PR which was just merged and added support for optional state seemed to be mostly focused on preventing panics, but, in this example, 'None' is now used to represent an actual logical result when computing the state.
> 
> This seems like we are adding unnecessary complexity. Personally, I'd advise on moving away from using marker types for state where None is seen as a logical variant. To me, None seems like to should only be used to represent uninitialized or removed state.
> 
> The user facing API I'd like to see in the examples would be, for example, `fn compute(sources: AppState) -> Self {`. Then, internally, Bevy could compute any derived state where any source state is None as None. 
> 
> My argument for this is that, as is, the `.set(...)` API only allows setting the state to some variant of State, and does not allow setting the state to None. Not including None for ComputedStates would make the ComputedStates trait API a closer match to the API for the FreelyMutableState (i.e. NextState). More specifically, and I could be mistaken, but I'm not aware that a .remove(...) API that exists for NextState. I.e.: the only way to set FreelyMutableState to none is by manually removing the state resource.
> 
> Edit:
> Other than that, this looks good! I think if we agree on the sugges … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
