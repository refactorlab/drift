# ryanoasis/nerd-fonts #1490 — Add inverse powerline arrow heads

**[View PR on GitHub](https://github.com/ryanoasis/nerd-fonts/pull/1490)**

| | |
|---|---|
| **Author** | @Finii |
| **Status** | ✅ merged |
| **Opened** | 2024-01-19 |
| **Repo importance** | ★63,239 · 3,900 forks · score 82,744 |
| **Diff** | +34 / −28 across 7 files |
| **Engagement** | 54 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @trashner — 1 reactions  
`👍 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1490#issuecomment-1902241370)

> I tested the provided patched fonts in Windows Terminal/PowerShell.
> 
> The new glyphs are available at the given code points, they look seamlessly alongside other glyphs and the background transparency works as well!

### @Finii — 1 reactions  
`😕 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1490#issuecomment-1903400852)

> Maybe for your use-case we should also add those glyphs without landing platforms.
> That could be also automated as CALTs; but maybe just to have the glyphs with different codepoints would be enough.
> 
> That is a classical target conflict :thinking:

### @a-usr — 1 reactions  
`👍 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1490#issuecomment-1903729899)

> > What is `CMDer`? Is that the old terminal one started with `cmd`? Is that not removed on Windows11? At least I had the impression Windows11 always has `Windows Terminal` instead of `cmd`?
> 
> ## (unnecessary info, if you dont care just skip this)
> 
> The terminal (or Console Emulator, Terminal Emulator to be precise, if you want I can try to explain why it is a terminal EMULATOR and not a terminal / what terminal actually means) that you're talking about is `conhost.exe`. `cmd` is a so called Shell (like powershell). A Shell needs a Terminal Emulator (or an actual terminal) to interact with the user (because it usually doesnt have any GUI). 
> When starting `cmd.exe`,  by either double clicking on the file in the `C:\system32` folder or using the windows run dialog, Windows first starts the default terminal Emulator and then connects the `cmd.exe` process to it. And as soon as the process is connected to the terminal emulator it can send characters to it.
> 
> ## useful info here:
> 
> on my windows 11 machine at least both `cmd.exe` and conhost are still existant, although i kind of agree with you that `conhost.exe`, the default terminal emultator up until windows 11, should have been removed. But you're right, Windows Terminal is the standard for Windows 11.

### @Finii — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1490#issuecomment-2297973105)

> > also noticed that the inverse + regular don't line up correctly such that they form a perfect arrow
> 
> That problem is already mentioned right in the top of this thread/PR, with a possible fix given in https://github.com/ryanoasis/nerd-fonts/pull/1490#issuecomment-1903418143 above (I sketched exactly that image on paper there ;)
> 
> The culprit are the 'landing platforms' on the left resp right that help avoid the vertical colored lines problem.
> Are these adjacent triangular things a common setup?
> 
> I'll add the new patched font into this comment in a minute...
> 
> _Edit:_
> 
> [FiraCodeNerdFont-Regular.zip](https://github.com/user-attachments/files/16669526/FiraCodeNerdFont-Regular.zip)
> 
> Green is the new outline:
> 
> ![image](https://github.com/user-attachments/assets/6b6ace27-116a-4c9b-a4ff-7e15c755f89e)
> 
> ```diff
> --- a/font-patcher
> +++ b/font-patcher
> @@ -853,8 +853,8 @@ class font_patcher:
>                  box_enabled = False # Cowardly not scaling existing glyphs, although the code would allow this
>  
>          # Stretch 'xz' or 'pa' (preserve aspect ratio)
> -        # Supported params: overlap | careful | xy-ratio | dont_copy | ypadding
> -        # Overlap value is used horizontally but vertically limited to 0.01
> +        # Supported params: overlap | voverlap | careful | xy-ratio | dont_copy | ypadding
> +        # Overlap value is used horizontally but vertically limited to 0.01 (or specified by voverlap)
>          # Careful does not overwrite/modify existing glyphs
>          # The xy-ratio limits the x-scale for a given y-scale to make the ratio <= this value (to prevent over-wide glyphs) … *[truncated]*

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1490#issuecomment-1900715395)

> Anyone interested to test the glyphs out?
> 
> I can create patched fonts for your preferred sourcefont and you can try.
> Please specify which font you'd like to test.

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1490#issuecomment-1902035907)

> Example:
> 
> ![image](https://github.com/ryanoasis/nerd-fonts/assets/16012374/f5b56565-8bce-4b20-8770-b0fd6d1bd1a4)
> 
> Basic font-set to try out:
> 
> [CaskaydiaCoveInverse.zip (10MB)](https://github.com/ryanoasis/nerd-fonts/files/13997450/CaskaydiaCoveInverse.zip)
> 
> ```
> Archive:  CaskaydiaCoveInverse.zip
>   Length      Date    Time    Name
> ---------  ---------- -----   ----
>   2198512  2024-01-20 10:01   CaskaydiaCoveNerdFont-BoldItalic.ttf
>   2349184  2024-01-20 10:01   CaskaydiaCoveNerdFont-Bold.ttf
>   2197532  2024-01-20 10:01   CaskaydiaCoveNerdFont-Italic.ttf
>   2122672  2024-01-20 10:01   CaskaydiaCoveNerdFontMono-BoldItalic.ttf
>   2270856  2024-01-20 10:02   CaskaydiaCoveNerdFontMono-Bold.ttf
>   2121692  2024-01-20 10:01   CaskaydiaCoveNerdFontMono-Italic.ttf
>   2269344  2024-01-20 10:02   CaskaydiaCoveNerdFontMono-Regular.ttf
>   2347672  2024-01-20 10:01   CaskaydiaCoveNerdFont-Regular.ttf
> ---------                     -------
>  17877464                     8 files
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
