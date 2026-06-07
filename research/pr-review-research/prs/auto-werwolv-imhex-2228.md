# WerWolv/ImHex #2228 — Implement skipping sequences of repeating bytes

**[View PR on GitHub](https://github.com/WerWolv/ImHex/pull/2228)**

| | |
|---|---|
| **Author** | @agarmash |
| **Status** | ✅ merged |
| **Opened** | 2025-05-05 |
| **Repo importance** | ★53,784 · 2,395 forks · score 68,284 |
| **Diff** | +162 / −0 across 5 files |
| **Engagement** | 17 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @paxcut — 0 reactions  
`—`  ·  [link](https://github.com/WerWolv/ImHex/pull/2228#issuecomment-2869772731)

> > This PR implements a neat little feature I missed - the ability to jump to the next/previous differing byte, skipping the chunk of repeating bytes. Very useful when you analyze a raw flash dump and want to skip the large sections of 0x00s/0xFFs.
> 
> Is this feature implemented in some hex editor you used before? I couldn't find anything like that to compare against. Your implementation seems like it only skips repeating bytes but a more general approach would skip words, double words, etc so if say the repeating pattern was 0xAABB you could also skip until the next different word,
> 
> > I wasn't sure what is the correct place to put the new menu entries into. The possible candidates were File -> Go to address... and Edit -> Follow selection. I chose the former, although the latter may be a better fit since it already states that the action is related to the selection. Overall, it may be a good moment to refine these menu entries in general.
> 
> Neither one of those seems like they apply. While it is true that the cursor position is being changed, there are lots of ways to move the cursor that don't necessarily belong in one of those two. What is important is the way in which the cursor is moved. In this case it is by searching, so the feature should be in the File>find menu as a separate tab of the existing hex and ascii options. The code should also be using the existing search code for the hex editor. This has the additional benefits of not having to create new menu entries and also the need to duplicate all the code that deals with providers or searching.
> 
> > I didn't add any te … *[truncated]*

### @agarmash — 0 reactions  
`—`  ·  [link](https://github.com/WerWolv/ImHex/pull/2228#issuecomment-3057233294)

> > Is this feature implemented in some hex editor you used before? I couldn't find anything like that to compare against. Your implementation seems like it only skips repeating bytes but a more general approach would skip words, double words, etc so if say the repeating pattern was 0xAABB you could also skip until the next different word
> 
> AFAIK no, I never saw anything similar in other editors either. As for the implementation extension - I see how skipping over a repeating pattern may be useful (skipping over the same pixels in a raw bitmap for example), but the only practical usecase I have at the moment is to only skip over a single repeating byte. To make life easier for both me and reviewers, I suggest implementing a single byte skip in this PR, and extend it in the following one.
> 
> > In this case it is by searching, so the feature should be in the File>find menu as a separate tab of the existing hex and ascii options.
> 
> Not sure if it would provide a good user experience (requiring to open a separate Search window to do the skip). Also, I'm not sure if it would be possible to assign hotkeys for the skip action in this case.
> 
> Instead of placing the new menu items in "Go to" menu, how about adding the one called "Skip until" next to it? I see it as good enough option.
> 
> > I sorry but for translations we require that native speakers translate all the text shown in ImHex and we don't allow AI translations of any kind.
> 
> No problem at all, I'll drop those!

### @agarmash — 0 reactions  
`—`  ·  [link](https://github.com/WerWolv/ImHex/pull/2228#issuecomment-3057830183)

> Just updated the implementation, now the UI looks like this:
> <img width="1977" height="1089" alt="Screenshot_20250710_165131" src="https://github.com/user-attachments/assets/cb965645-de29-40e4-8d62-0dfbe31b63d6" />
> 
> As for the following:
> > The code should also be using the existing search code for the hex editor.
> 
> I checked the existing implementation, but in a nutshell it's just a wrapper around the `std::search`: https://github.com/WerWolv/ImHex/blob/master/plugins/builtin/source/content/popups/hex_editor/popup_hex_editor_find.cpp#L231
> I don't need a full-blown `std::search` here, so I decided to keep the simple custom implementation.

### @agarmash — 0 reactions  
`—`  ·  [link](https://github.com/WerWolv/ImHex/pull/2228#issuecomment-3058080370)

> @WerWolv nice, glad to hear!
> 
> How shall we proceed with the PR then? Are you expecting some other people to review it?

### @paxcut — 0 reactions  
`—`  ·  [link](https://github.com/WerWolv/ImHex/pull/2228#issuecomment-3058106892)

> In my opinion this would be much cleaner if it was a checkbox in the normal search so that it works on hex values and strings. The current search code can be easily adapted to have a custom comparison of NotEquals. You would get more functionality with a lot less code duplication  and without further crowding the menus. But, hey, its just my opinion.

### @paxcut — 0 reactions  
`—`  ·  [link](https://github.com/WerWolv/ImHex/pull/2228#issuecomment-3058135577)

> > I checked the existing implementation, but in a nutshell it's just a wrapper around the std::search: https://github.com/WerWolv/ImHex/blob/master/plugins/builtin/source/content/popups/hex_editor/popup_hex_editor_find.cpp#L231
> I don't need a full-blown std::search here, so I decided to keep the simple custom implementation.
> 
> The point is that there is no need to reinvent the wheel. We have a search function and you are implementing a search function. So we end up with two search functions that do the same thing, not to mention  the duplication of the provider code and the reading of the data and pretty much everything. you are just adding a `not of` option to the search. If we could use regular expressions when searching for sequences, there would be no need to even add an option for it during search. Another option would be to add special notation like `!` to denote match anything that is not this value.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
