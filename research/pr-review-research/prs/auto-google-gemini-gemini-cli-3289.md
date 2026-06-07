# google-gemini/gemini-cli #3289 — Add terminal setup command for Shift+Enter and Ctrl+Enter support

**[View PR on GitHub](https://github.com/google-gemini/gemini-cli/pull/3289)**

| | |
|---|---|
| **Author** | @deepankarsharma |
| **Status** | ✅ merged |
| **Opened** | 2025-07-05 |
| **Repo importance** | ★104,966 · 13,991 forks · score 165,925 |
| **Diff** | +989 / −18 across 19 files |
| **Engagement** | 22 conversation · 67 inline review comments |

## Top review comments (ranked by reactions)

### @kovidgoyal — 1 reactions  
`👍 1`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/3289#issuecomment-3038313803)

> Doing this will *break* the usage of those keys in other terminal programs. You cant remap keys globally for your individual program by modifying conf files for the terminal emulator. If you want to support shift+enter and ctrl+enter correctly, add support for the kitty keyboard protocol, which supports those key combinations in all of the terminals above except possibly urxvt.

### @aalexand — 1 reactions  
`👍 1`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/3289#issuecomment-3177221258)

> > We work out of the box on iterm2 even without that box ticked.
> 
> That's cool!

### @deepankarsharma — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/3289#issuecomment-3038323172)

> Thanks for the pointer @kovidgoyal! I will go through https://sw.kovidgoyal.net/kitty/keyboard-protocol and see if the approach works with the terminals listed above. I will look at urxvt separately and see how that should be handled.

### @JeelRajodiya — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/3289#issuecomment-3058026488)

> Hello @deepankarsharma, are you still working on the issue? I would like to give it a try if you are not working on it anymore!

### @deepankarsharma — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/3289#issuecomment-3058912908)

> @JeelRajodiya - Code for this is almost ready to go. I am traveling this week so dont have access to a Windows machine to test the change on windows. I should be able to get this ready for review shape by early next week.

### @JeelRajodiya — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/3289#issuecomment-3061662977)

> Sure! No worries. Thanks for the update!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
