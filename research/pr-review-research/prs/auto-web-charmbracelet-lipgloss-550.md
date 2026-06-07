# charmbracelet/lipgloss #550 — feat: color blending & other low-level color utilities

**[View PR on GitHub](https://github.com/charmbracelet/lipgloss/pull/550)**

| | |
|---|---|
| **Author** | @lrstanley |
| **Status** | Merged (August 14, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aymanbagabas
> Since we already have coloring functionality in the root package `lipgloss`, I wonder if it makes more sense to move these functions there

### @meowgorithm
> My gut says to move the color functionality to the top level, unless we want to move all existing color to a subpackage.

### @aymanbagabas
> I think moving the color functionality to the top level is more idiomatic Go than moving them to a subpackage.

### @aymanbagabas
> we could rename `BlendLinear1D` and `BlendLinear2D` to `Blend` and `Blend2D` respectively. Which is shorter and less confusing.

### @meowgorithm
> we could also alias `Blend1D` to `BlendLinear1D` and so on for those who would prefer to be explicit.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
