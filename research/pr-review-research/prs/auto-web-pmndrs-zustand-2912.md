# pmndrs/zustand #2912 — chore(eslint): migrate to flat config and simplify

**[View PR on GitHub](https://github.com/pmndrs/zustand/pull/2912)**

| | |
|---|---|
| **Author** | @sukvvon |
| **Status** | Merged (by dai-shi on Dec 29, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dai-shi
> This is nice! I wasn't sure when all plugins are ready. They weren't when I last tried. Are you sure all configs are migrated? No additions or removals?

### @dbritto-dev
> IMHO, I prefer no config or simple config instead of complex config...We can use something else like OXC lint or Biome and simplify the config.

### @dai-shi
> Let's do some practices that I learned with jotaijs/jotai-valtio#11. The primary goal is to simplify configs and prefer defaults

(Followed by specific requests including removing eslint-config-prettier, simplifying eslint.config.js, using ESM syntax, removing globals packages, and eliminating example configs.)

### @dbritto-dev
> I wouldn't put much effort on eslint is pretty slow and now are better options, apart from that biome is ready for production.

### @dai-shi
> Our ecosystem still depends on eslint plugins. Maybe, eslint-plugin-react-compiler is one of the biggest hurdles. Let's stick with eslint.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
