# tesseract-ocr/tesseract #4534 — Use asciidoctor instead of asciidoc-py for manpage generation

**[View PR on GitHub](https://github.com/tesseract-ocr/tesseract/pull/4534)**

| | |
|---|---|
| **Author** | @Copilot |
| **Status** | ✅ merged |
| **Opened** | 2026-03-24 |
| **Repo importance** | ★74,507 · 10,653 forks · score 122,103 |
| **Diff** | +51 / −47 across 5 files |
| **Engagement** | 23 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @stweil — 1 reactions  
`👀 1`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4534#issuecomment-4275803911)

> @copilot, https://github.com/tesseract-ocr/tesseract/actions/runs/24627620635/job/72009278898 failed.

### @stweil — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4534#issuecomment-4119190388)

> @copilot, is it possible to extend the CI (GitHub workflow actions) to produce documentation with asciidoctor and to allow the download of this documentation as build artifacts? The "autotools" workflow might be a good location for this task, ideally not for the whole matrix of operating systems and compilers, but only for one of them with.

### @Copilot — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4534#issuecomment-4119213482)

> > @copilot, is it possible to extend the CI (GitHub workflow actions) to produce documentation with asciidoctor and to allow the download of this documentation as build artifacts? The "autotools" workfl...
> 
> Done in commit 9264bf1. The `autotools.yml` workflow now:
> 
> - Marks the `ubuntu-24.04-gcc-14` matrix entry with `docs: true`
> - Installs `asciidoctor` (apt) and `asciidoctor-pdf` (gem) only for that config
> - Configures with `--enable-doc` (vs `--disable-doc` for all others) so asciidoctor is picked up
> - Runs `make html pdf` to build the rendered docs
> - Uploads `doc/*.html`, `doc/*.pdf`, `doc/*.1`, and `doc/*.5` as the `tesseract-docs` artifact

### @amitdo — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4534#issuecomment-4119684513)

> @copilot+claude-sonnet-4.6 ,
> 
> Please also edit nsis/build.sh

### @Copilot — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4534#issuecomment-4119696418)

> > @copilot+claude-sonnet-4.6 ,
> > 
> > Please also edit nsis/build.sh
> 
> Done in commit 867bb7b. Replaced `asciidoc curl xsltproc docbook-xml docbook-xsl` with `asciidoctor curl` in the `apt-get install` command in `nsis/build.sh`.

### @amitdo — 0 reactions  
`—`  ·  [link](https://github.com/tesseract-ocr/tesseract/pull/4534#issuecomment-4275537380)

> @copilot
> 
> https://packages.ubuntu.com/search?keywords=asciidoctor
> 
> In `nsis/build.sh`:
> 
> ` apt-get ... asciidoctor`
> 
> replace `asciidoctor` with `ruby-asciidoctor-pdf`
> 
> Also do the same in `.github/workflows/autotools.yml`
> 
> and remove:
> 
> `sudo gem install asciidoctor-pdf`


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
