# wez/wezterm #6290 — add cellwidths option #6289

**[View PR on GitHub](https://github.com/wez/wezterm/pull/6290)**

| | |
|---|---|
| **Author** | @hamano |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wez
> we need to adjust this a bit to avoid excessive copying of the map in the hot code paths

### @wez
> you should add a file alongside `docs/config/lua/config/treat_east_asian_ambiguous_width_as_wide.md` for the new option

### @hamano
> The cell_widths option is intended only for widths of 1 or 2. Even if support for widths of 3 or more were added, it wouldn't be useful since both Vim and the glibc locale only handle widths of 1 or 2.

### @ProfessorMOB
> characters like ﷽ still aren't displayed properly, its now taking two spaces instead of one

### @wez
> if your shell, or other application that you are using, doesn't agree with the terminal on the width, then this is exactly the sort of behavior that you can expect

### @hamano
> Supporting terminals alone would not be practical (without corresponding shell/locale support for character width handling)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
