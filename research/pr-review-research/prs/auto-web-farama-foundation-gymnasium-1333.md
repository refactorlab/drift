# Farama-Foundation/Gymnasium #1333 — Add generic conversion wrapper between Array API compatible frameworks

**[View PR on GitHub](https://github.com/Farama-Foundation/Gymnasium/pull/1333)**

| | |
|---|---|
| **Author** | @amacati |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pseudo-rnd-thoughts
> I realised that an important aspect of the NumpyToTorch wrapper is not just that the wrapper returns torch observations etc, but that you can pass torch actions which are converted to NumPy for the environment.

### @RedTachyon
> Do we need EzPickle here? Plus does this actually work with arbitrary envs? If I remember right, the idea behind EzPickle is that you can 'fake pickle' an environment...

### @RedTachyon
> This is where things might get a bit dicey. Options are meant to be relatively free-form, and I don't think we should force any specific structure on this object.

### @pseudo-rnd-thoughts
> Would `DataConversion` be a more helpful name than `ToArray` for users?

### @amacati
> The `array_conversion` wrappers have a hard requirement on Python 3.10 and above, so we would need to raise an error if someone is trying to import these on Python 3.9.

### @pseudo-rnd-thoughts
> With other PRs that we are going to have to make...means that I think we can add this now and go with the pain of dropping Python 3.8 and 3.9.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
