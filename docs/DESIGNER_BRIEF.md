# Drift PR-comment — Designer brief (section-header banners + report polish)

**Goal.** Give Drift's GitHub PR comment ("Andy") the designed, "official report" feel of the
[README](../README.md): a branded full-width **section-header banner** above each major section,
so the comment reads like a product report, not a chatty bot.

**This brief is a contract with the code.** The renderer in
[`action/src/render/overview.ts`](../action/src/render/overview.ts) already references each banner
by an exact filename + `alt` string (function `withImage()`):

```ts
const SCREENSHOTS = 'https://raw.githubusercontent.com/refactorlab/andy/main/docs/screenshots';
const sectionImage = (file, alt) => `<p><img src="${SCREENSHOTS}/${file}" alt="${alt}" width="100%" /></p>`;
```

So: **produce the files, commit them to `refactorlab/andy:docs/screenshots/`, and they appear in
the comment with zero code change.** They're fail-soft — GitHub's Camo proxy degrades a missing
image to its `alt` text, so the comment is never broken while assets are pending.

---

## 0. Hard constraints (GitHub + Camo — read first)

| Constraint | What it means for you |
|---|---|
| **Format: PNG** (the code points at `.png`) | Deliver optimized PNG. SVG would also work if the maintainer switches the URLs, but today the contract is PNG. |
| **One image, no theme switch** | `sectionImage()` emits a single `<img>` (not a `<picture>`), so the **same** PNG shows on light **and** dark GitHub. Design it to read on **both** `#ffffff` and `#0d1117` — use a transparent background with a brand-orange rule + ink that has contrast on either (or bake a subtle neutral plate). *(Optional upgrade: the maintainer can switch `sectionImage` to a `<picture>` with `-light`/`-dark` variants; see §4.)* |
| **Camo proxy + caching** | Images are server-fetched and cached for days. When you re-export, change the filename or ask the maintainer to add a `?v=N` bump, or the old one serves stale. |
| **Must degrade to `alt`** | Each `alt` below is written as a complete label. The banner is *polish*; on a 404 the section still reads (the plain `## Heading` sits right under every banner). |
| **Full-width** | Rendered at `width="100%"`; design a wide banner, export at 2× for crispness. |
| **Tiny** | Target ≤ ~60 KB per PNG (run through pngquant/oxipng). |

---

## 1. Brand & palette (exact values — from [`severity.ts`](../action/src/render/lib/severity.ts))

| Token | Hex | Use |
|---|---|---|
| **Brand orange** | `#ff6b3d` | Andy/Drift mark, the section rule, "▲" |
| Green (ship) | `#2ea043` | improvement · tested |
| Amber (attention) | `#d29922` | mixed · to-address |
| Red (regression) | `#d1242f` | regression · untested |
| Blue (advisory) | `#58a6ff` | neutral / informational |
| Grey (flat) | `#8b949e` | muted |
| Surface light / dark | `#ffffff` / `#0d1117` | test the banner on **both** |
| Ink light / dark | `#1f2328` / `#e6edf3` | the banner ink must read on both |

**Type:** match the README wordmark (geometric/grotesque sans). The "▲ Drift" mark stays brand
orange. Since these are raster PNGs, fonts are baked in — no font-embedding concerns.

---

## 2. The six section-header banners ⭐ (the core deliverable)

> **Filenames + `alt` are the contract** — match exactly. All live in
> `refactorlab/andy:docs/screenshots/`.

| Order | File | `alt` (must match the code) | Section it heads | Icon motif |
|:--:|---|---|---|---|
| 1 | `drift-review.png` | `Drift review` | The header (verdict, gauges, KPIs) | ▲ Drift mark + "PR review" |
| 2 | `reviewers-guide.png` | `Reviewer's guide` | 🧭 Reviewer's guide (the triage panel) | 🧭 compass |
| 3 | `architecture.png` | `Architecture` | 🏗 Architecture (before/after diagrams) | 🏗 nodes/graph |
| 4 | `business-value.png` | `Business value` | 📊 Business value (the value dashboard) | 📊 bars |
| 5 | `code-suggestions.png` | `Code suggestions` | ⚠️ Code suggestions | 💡 lightbulb |
| 6 | `andy.png` | `Andy — your PR handoff assistant` | The footer sign-off | the Andy mark |
| 7 | `summary-audio.png` | `🔊 Listen to the spoken summary (Piper TTS)` | **Clickable audio button** (footer; only when a spoken summary exists) — wrapped in a link to the audio artifact | 🔊 / play-button, "Listen to the 30-sec verdict" |

**`summary-audio.png` is a BUTTON**, not a header strip: design it to read as tappable (play
glyph + "Listen to the spoken summary" label, brand-orange fill). It renders centered and links
out, so make it look interactive.

**Banner spec (the six section headers):**
- **Canvas:** 1280 × 96 logical px (export @2× → 2560 × 192). Renders at `width="100%"`.
- **Layout:** left-aligned section **icon + label** in the brand font, sitting on a 2 px
  brand-orange `#ff6b3d` rule that runs the full width; generous left padding (~48 px).
- **Background:** transparent; ink/strokes chosen to read on both `#ffffff` and `#0d1117`
  (mid-tone ink + the orange rule reads on both; avoid pure black or pure white fills).
- **Consistency:** identical height, rule weight, padding, and type scale across all six so they
  stack as a coherent set.

That's the whole required set. Everything below is **optional** polish the renderer doesn't
reference yet — pick up only if you want the full report system.

---

## 3. Optional enhancements (not wired today — propose if you want the full system)

- **Value-axis icon set** — `axis-money.png · axis-customer.png · axis-runtime.png · axis-ux.png`
  (24×24 @2×) to replace the 💰👥⚙️🎨 emoji in the value-card column headers. Colors from §1.
- **Legend / key image** — `legend.png` (~960×320) defining the palette + axis icons + the
  ⅛-block magnitude-bar glyph, shown once in the footer methodology disclosure.
- **Status-header variants** — `status-ship.png` / `status-attention.png` / `status-regression.png`
  selected by verdict, for a Vercel-dashboard-style top banner.
- **Agent-ready badge logo** — a single-path white "▲" SVG ≤ 2 KB, base64-inlined into the
  brand-orange `agent-ready: N fix prompts` shields badge (`logo=data:image/svg+xml;base64,…`) —
  no hosting, no 404 path.

Wiring any of these is a one-line renderer change per asset; flag them and the maintainer adds it.

---

## 4. README screenshots (the "generate screenshots" ask)

Refresh the README hero/example shots against the **new** comment (now led by the Reviewer's
guide). Capture at 1280 px content width, 2× DPI, on a real PR, in **both** themes:

1. **`hero-reviewers-guide.png`** — the new 🧭 Reviewer's guide block (at-a-glance heat line, ✅
   Clean validations, Focused-PR verdict, Key-issues table). *This is the new hero shot.*
2. **`comment-full.png`** — the whole sticky comment top-to-bottom on a real PR.
3. Refresh the existing `value-card` / `architecture` close-ups.

---

## 5. Delivery checklist

For each of the six banners:

- [ ] Filename matches §2 **exactly**.
- [ ] Reads clearly on **both** `#ffffff` and `#0d1117` (paste into a GitHub comment preview on
      both themes before sign-off).
- [ ] Palette values match §1; identical height/rule/padding across the set.
- [ ] PNG optimized (≤ ~60 KB); exported @2×.
- [ ] `alt` text (in the code) still matches the section label — flag the maintainer if a label changes.

Commit to `refactorlab/andy:docs/screenshots/`. They appear automatically — no flag, no code change.
(If a banner doesn't show immediately, it's Camo caching; bump the filename or add `?v=N`.)

---

## 6. How the renderer consumes these (for QA)

- [`overview.ts`](../action/src/render/overview.ts) `withImage(file, alt, section)` prepends the
  banner above the section's markdown. Banners head: header (`drift-review`), Reviewer's guide
  (`reviewers-guide`), Architecture, Business value, Code suggestions, and the footer (`andy`).
- The plain `## …` heading remains directly under each banner as the accessible anchor + 404
  fallback — so the banner is purely additive polish.
