# alpinejs/alpine #4175 — 🐛 Masks model updates

**[View PR on GitHub](https://github.com/alpinejs/alpine/pull/4175)**

| | |
|---|---|
| **Author** | @ekwoka |
| **Status** | Merged (Feb 11, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @calebporzio
> can you provide a clearer explanation of what this PR is doing? Thanks. (also, clever approach: decorating the forceModelUpdate method)

### @ariaieboy
> The problem is that when we change the Alpine data using JS the mask won't apply to the changed value... The value should get masked and return `123,000`

### @matthias-margin
> anything we can do to help push this along? we're running into this issue as well with some money inputs that can be changed by the user or by code.

### @calebporzio
> The decorator pattern is the right approach — minimal, surgical, and hooks into the existing `_x_forceModelUpdate` contract without modifying core Alpine.

### @jamsouf
> I'm binding the input field to a Livewire property with wire:model. After updating the property value in the backend, the input field shows the new value, but is not masking it.

### @avatar2033
> When will this PR be merged? This is a serious problem

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
