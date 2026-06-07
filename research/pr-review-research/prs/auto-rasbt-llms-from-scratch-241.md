# rasbt/LLMs-from-scratch #241 — Show epochs as integers on x-axis

**[View PR on GitHub](https://github.com/rasbt/LLMs-from-scratch/pull/241)**

| | |
|---|---|
| **Author** | @rasbt |
| **Status** | ✅ merged |
| **Opened** | 2024-06-22 |
| **Repo importance** | ★96,688 · 14,787 forks · score 160,796 |
| **Diff** | +88 / −69 across 5 files |
| **Engagement** | 16 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/241#issuecomment-2184974007)

> yes, usually the `;` does the trick. Not here though. I think that's because of the `plt.figure`. Even a separate `plt.show();` doesn't help. But yeah, this is really not important :P
> 
> <img width="460" alt="Screenshot 2024-06-23 at 7 40 08 AM" src="https://github.com/rasbt/LLMs-from-scratch/assets/5618407/ef3b6cdb-f7b6-42b7-b4c2-c7c2b6545eed">

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/241#issuecomment-2185004274)

> Hm, yeah it does look fine for me now. Weird but nice, because it simplifies the code :)

### @d-kleine — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/241#issuecomment-2185007976)

> Yeah, actually the `fig.tight_layout()` should avoid overlaps between axis labels and axis tick labels.
> But nice, we killed two birds with one stone (epochs with integer values only + shorter code in notebook) 👍🏻🙂

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/241#issuecomment-2185013355)

> > fig.tight_layout()
> 
> yes, that's why I found it so weird that the other lines had to be added. Maybe the recent integer label formatting of the x-axis was somehow involved, haha

### @d-kleine — 0 reactions  
`—`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/241#issuecomment-2184204266)

> Just checked out, but for the *ch07/01_main-chapter-code/exercise-solutions.ipynb* it doesn't have any effect as the `plot_losses()` func is at *ch07/01_main-chapter-code/exercise_experiments.py* and has not been changed

### @rasbt — 0 reactions  
`—`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/241#issuecomment-2184243047)

> Ah, I forgot that I copied the function into there to disable the `plot.show()`. I found it a bit annoying to have the plots shown interactively there.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
