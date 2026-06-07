# docling-project/docling #2890 — feat: added support for parsing LaTeX (.tex) documents

**[View PR on GitHub](https://github.com/docling-project/docling/pull/2890)**

| | |
|---|---|
| **Author** | @adityasasidhar |
| **Status** | ✅ merged |
| **Opened** | 2026-01-18 |
| **Repo importance** | ★61,011 · 4,260 forks · score 83,049 |
| **Diff** | +106375 / −3 across 129 files |
| **Engagement** | 35 conversation · 12 inline review comments |

## Top review comments (ranked by reactions)

### @adityasasidhar — 1 reactions  
`😄 1`  ·  [link](https://github.com/docling-project/docling/pull/2890#issuecomment-3767019293)

> > ## [Codecov](https://app.codecov.io/gh/docling-project/docling/pull/2890?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=docling-project) Report
> 
> ## Updated: Improved Test Coverage
> 
> The initial submission passed **all 25 required CI checks** (lint, tests across Python 3.9-3.14, examples, docs, DCO) but missed the codecov threshold (57% vs 73.16% target).
> 
> I've now added **33 additional unit tests** (39 total) to achieve **~86% coverage**, well above the target.
> 
> ### New tests cover:
> - ✅ All heading levels (`\part`, `\chapter`, `\section`, `\subsection`, `\subsubsection`)
> - ✅ List environments ([itemize](cci:1://file:///home/aditya/PycharmProjects/docling/tests/test_backend_latex.py:211:0-236:54), [enumerate](cci:1://file:///home/aditya/PycharmProjects/docling/tests/test_backend_latex.py:239:0-260:31), [description](cci:1://file:///home/aditya/PycharmProjects/docling/tests/test_backend_latex.py:263:0-284:31))
> - ✅ Code blocks ([verbatim](cci:1://file:///home/aditya/PycharmProjects/docling/docling/backend/latex_backend.py:416:4-423:24), [lstlisting](cci:1://file:///home/aditya/PycharmProjects/docling/tests/test_backend_latex.py:312:0-334:31))
> - ✅ Math environments (`equation*`, `gather`, `multline`, [displaymath](cci:1://file:///home/aditya/PycharmProjects/docling/tests/test_backend_latex.py:894:0-912:29))
> - ✅ Macros: `\footnote`, `\url`, `\caption`, `\label`, `\cite`, `\ref`
> - ✅ `\includegraphics` and [figure](cci:1://file:///home/aditya/PycharmProjects/docling/tests/test_backend_latex.py:626:0-648:2 … *[truncated]*

### @cau-git — 1 reactions  
`😄 1`  ·  [link](https://github.com/docling-project/docling/pull/2890#issuecomment-3769746323)

> @adityasasidhar Nice progress. Maybe this is a good point to add some sample latex file into `tests/data` and ensure that ground-truth representations are generated like with the other file formats, so new changes to the latex backend will show what improved or regressed.

### @adityasasidhar — 1 reactions  
`😄 1`  ·  [link](https://github.com/docling-project/docling/pull/2890#issuecomment-3773900088)

> > @adityasasidhar Nice progress. Maybe this is a good point to add some sample latex file into `tests/data` and ensure that ground-truth representations are generated like with the other file formats, so new changes to the latex backend will show what improved or regressed.
> 
> @cau-git @PeterStaar-IBM Thank you for the feedback!
> 
> I've significantly overhauled the implementation to allow for end-to-end ground-truth validation against real-world scientific papers.
> 
> To ensure the backend is robust enough for general use, I added the full source code for 4 major arXiv papers (Attention Is All You Need, DeepSeek V3, Mistral 7B, and OTSL) to the test suite and regenerated the ground-truth data.
> 
> Testing against these complex documents revealed several real-world parsing challenges which I have now resolved:
> 
> Split-file Documents: Added recursive support for \input{} and \include{} to handle papers that are split across multiple 
> .tex
>  files.
> Custom Macros: Implemented expansion of user-defined macros (e.g., \newcommand) to ensure custom terms appear correctly in the output text.
> Complex Preambles: Improved filtering to ensure only the document content is parsed, ignoring metadata and preamble definitions.
> Asset Management: Restructured the test data to correctly resolve relative paths for images, bibliographies, and sub-files.
> 
> There's still a lot of work to perfect it, I had some ideas reagrding restructuring tables and all using llm's, the user can probably pass some arguments regarding it to use ( just my thoughts ), as you see manual parsing through the latex code leaves us wit … *[truncated]*

### @adityasasidhar — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/2890#issuecomment-3790692329)

> @vku-ibm @PeterStaar-IBM thank you for the thorough testing! Working on fixes for:
> ✅ Comment line crash (regex escape handling)
> ✅ Inline math staying within paragraphs (not breaking text flow)
> ✅ .ps/.eps image format support

### @vku-ibm — 1 reactions  
`😄 1`  ·  [link](https://github.com/docling-project/docling/pull/2890#issuecomment-3791409622)

> > isn't it better to preserve the scientific notations as we are parsing through academic papers...most probably someone would want the extra bit of context if you are specfically gonna put .tex files..but all in all a project is supposed to be consistent...your call please
> 
> My apologies for not being clear. Yes, we do want to preserve scientific notation and this backend does it. I was pointing out that docling doesn't do it by default with the pdf backend. So this point wasn't the "bug report" but an observation.

### @PeterStaar-IBM — 1 reactions  
`😄 1`  ·  [link](https://github.com/docling-project/docling/pull/2890#issuecomment-3792157129)

> > > > isn't it better to preserve the scientific notations as we are parsing through academic papers...most probably someone would want the extra bit of context if you are specfically gonna put .tex files..but all in all a project is supposed to be consistent...your call please
> > > 
> > > 
> > > My apologies for not being clear. Yes, we do want to preserve scientific notation and this backend does it. I was pointing out that docling doesn't do it by default with the pdf backend. So this point wasn't the "bug report" but an observation.
> > 
> > @vku-ibm my bad if I came off accusing, almost done with the fixes, testing it a bit for edge cases...will push it once finished
> 
> @adityasasidhar no worries, we (=docling team) dont take these things personal, just love your enthusiasm! Latex is a real pain sometimes, and we need to get some good rough coverage before we merge. The next iterations can then be improvements.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
