# laravel/laravel #6714 — Ignore Laravel compiled views for Vite

**[View PR on GitHub](https://github.com/laravel/laravel/pull/6714)**

| | |
|---|---|
| **Author** | @QistiAmal1212 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @calebporzio
> In general, I think it makes sense to configure Vite to ignore those directories. Their files are always derived from actual source files and Vite should pick up the changes from those source files. I am surprised that a Livewire interaction is causing those files to change and Vite to re-load the page.

### @calebporzio
> I use Vite locally with Livewire and it doesn't have that behavior for me. Only when I modify a Livewire source file will it re-load. I also tested this in a new app locally with both Livewire 3 and 4 and wasn't experiencing what you're describing.

### @taylorotwell
> @QistiAmal1212 are you using Volt?

### @francoism90
> Could you simply ignore the full /storage path instead?

### @QistiAmal1212
> I think we can't completely ignore the entire /storage path, because it also contains system-stored files like images or other assets. For example, during development there may be cases where I store private images or files there and need to immediately see the changes reflected.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
