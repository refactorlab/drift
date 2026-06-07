# ocornut/imgui #7925 — Add native UTF8 support for InputText and remove ImWchar buffer

**[View PR on GitHub](https://github.com/ocornut/imgui/pull/7925)**

| | |
|---|---|
| **Author** | @alektron |
| **Status** | ✅ merged |
| **Opened** | 2024-08-27 |
| **Repo importance** | ★73,695 · 11,792 forks · score 125,848 |
| **Diff** | +258 / −203 across 7 files |
| **Engagement** | 15 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @ocornut — 1 reactions  
`👍 1`  ·  [link](https://github.com/ocornut/imgui/pull/7925#issuecomment-2331629388)

> Thank you very much. This looks pretty good and I will try to review it shortly. I have already rebased the branch locally to look at it. It's been indeed the much needed first step toward a fuller refactor of `InputText()` so I appreciate it. 
> 
> The truth is, rokups has done this work already but as part of a larger refactor. 
> I will need to look at both work. Yours here has the advantage that it is limited to that one step and therefore for me is an attractive merge. Rokas's one has the advantage of (I assume) more naturally fitting with his remaining changes. I'll figure things out.

### @ocornut — 1 reactions  
`🚀 1`  ·  [link](https://github.com/ocornut/imgui/pull/7925#issuecomment-2343534039)

> - Fixed infinite loop in clipboard paste filtering 1af5884
> - Optimized and simplified some search loops, now can use memchr/strchr 0020036
> 
> That's large optimization is extremely valuable, and couldn't be done before because we had to support ImWchar and they can be either 16 or 32 bytes.
> 
> Quick test pasting a ~900 KB file, VS2022 x64 Debug Mode:
> 
> ```
> BEFORE
> large, top, ~3.65 ms
> large, bottom ~4.0 ms
> select all, top ~3.7 ms
> select all, bottom, ~6.0 ms
> 
> BRANCH BEFORE LAST COMMIT (memchr/strchr)
> large, top ~2.2 ms
> large, bottom ~2.5 ms
> select all, top ~2.2 ms
> select all, bottom ~4.5 ms
> 
> BRANCH AFTER LAST COMMIT
> large, top ~0.87 ms
> large, bottom ~1.2 ms
> select all, top, ~0.9 ms
> select all, bottom, ~1.9 ms
> ```
> 
> This quite good.
> 
> I am pretty sure they are other good opportunities that will now become easier to see and take advantage of. 
> Among other, the multi-line renderer already established top and bottom visible lines, and this work is duplicated by the AddText() call.

### @ocornut — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/ocornut/imgui/pull/7925#issuecomment-2343575520)

> Merged into main branch. Thanks for your help!

### @ocornut — 1 reactions  
`👀 1`  ·  [link](https://github.com/ocornut/imgui/pull/7925#issuecomment-2356691116)

> Found another bug from Initial commit abd07f6
> ![image](https://github.com/user-attachments/assets/086ac0bc-0266-45be-a756-490dc4890841)
> 
> I luckily noticed it because it broke the memory editor which used `callback_data.SelectionEnd`.
> 
> Fixed by f7ba645!

### @ocornut — 0 reactions  
`—`  ·  [link](https://github.com/ocornut/imgui/pull/7925#issuecomment-2331873365)

> Here are some changes I made:
> 
> - I introduced a `stb_textedit_text()` function. legacy `stb_textedit_key()` path can still call `stb_textedit_text()` but imgui calls this directly. Added equivalent ImGuiInputTextState::OnCharPressed().
> - tweaked InputTextCalcTextSize() so it doesn't need to call a function for ASCII. it's a potential debug-mode perf regression for large buffers. using similar code as `ImFont::CalcTextSizeA()` and added note that ideally should would be shared (no hurry with that).
> - I added a note that STB_TEXTEDIT_GETCHAR() was at this point more of a `STB_TEXTEDIT_GETBYTE()` and verified that it is used accordingly (ascii compares or block copy).
> ```cpp
> // With our UTF-8 use of stb_textedit:
> // - STB_TEXTEDIT_GETCHAR is nothing more than a a "GETBYTE". It's only used to compare to ascii or to copy blocks of text so we are fine.
> // - One exception is the STB_TEXTEDIT_IS_SPACE feature which would expect a full char in order to handle full-width space such as 0x3000 (see ImCharIsBlankW).
> // - ...but we don't use that feature.
> ```
> - If while working on this (before or after) you can come up with any extra test to add to test suite please let me know! even if you don't want to add them yourself, i'll log every idea.
> - We can remove the A suffixes later after this is merged and settled.
> 
> This needs further works:
> - [x] Couldn't IMSTB_TEXTEDIT_GETPREVCHARINDEX_IMPL() simply use ImTextFindPreviousUtf8Codepoint() ? much less code and likely faster.
> - [x] STB_TEXTEDIT_MOVEWORDLEFT_IMPL, STB_TEXTEDIT_MOVEWORDRIGHT_MAC, STB_TEXTEDIT_MOVEWORDRIGHT_WIN as we don't hand … *[truncated]*

### @ocornut — 0 reactions  
`—`  ·  [link](https://github.com/ocornut/imgui/pull/7925#issuecomment-2332511767)

> I think I have fixed all the things except `InputTextReconcileUndoStateAfterUserCallback()`.
> Would you mind reviewing my commits?
> 
> If for some reason you need to run or modify tests, the modified test is in a public branch: https://github.com/ocornut/imgui_test_engine/tree/features/input_text_7925
> 
> About `InputTextReconcileUndoStateAfterUserCallback()`, notice the comment:
> ```cpp
> // Find the shortest single replacement we can make to get the new text from the old text.
> // Important: needs to be run before TextW is rewritten with the new characters because calling STB_TEXTEDIT_GETCHAR() at the end.
> // FIXME: Ideally we should transition toward (1) making InsertChars()/DeleteChars() update undo-stack (2) discourage (and keep reconcile) or obsolete (and remove reconcile) accessing buffer directly.
> ```
> 
> The part about needing to run before TextW is rewritten is essentially broken now, for the good reason that we were using this buffer as an "old buffer". Solving this the same way would annoyingly requires us to make a copy of the full text before running the callback. aka possibly worse case every frame since the Always callback is technically allowed to modify character...
> 
> PLAN A
> - We only do a copy and handle reconcile on selected callbacks: Completion, History. Seems limiting.
> - We implement what is suggested in the comment aka make InsertChars()/DeleteChars() update undo stack themselves. And we introduce a slightly breaking feature where directly modifying the buffer will break reconcile.
> - Having no reconcile can literally break undo stack and crash: #4947, #4949. Actual … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
