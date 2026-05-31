# Drift PR-comment — Designer brief (the "official report" visual layer)

**Goal.** Give Drift's GitHub PR comment ("Andy") the same designed, production-grade
feel as the [README](../../README.md): a brand banner, branded section-title strips,
a status header, a legend key, and a small icon system — so a reviewer feels like they're
reading an *official report*, not a chatty bot.

**Who consumes this.** The renderer in [`action/src/render/`](../../action/src/render/) already
references every asset below by a fixed URL and a precise `alt` string. You produce the files,
drop them in `docs/report/` of the **`refactorlab/andy`** repo, and the comment picks them up —
**zero code changes**. Until then the comment stays text/emoji-clean (see *Rollout*).

---

## 0. Hard constraints (please read first — these are non-negotiable)

GitHub renders PR comments through a **sanitizer** and proxies every image through **Camo**.
That dictates the whole asset format:

| Constraint | What it means for you |
|---|---|
| **SVG, presentation-attributes only** | No `<style>`, no inline `style="…"`, no `<script>`, no external `<image href>`, no web-fonts via `@import`. Use `fill=`, `stroke=`, `x=`, etc. as attributes. **Convert all text to outlines/paths** (GitHub strips font references, so live text won't render). |
| **Camo proxy** | Images are fetched server-side and cached aggressively (days–weeks). We cache-bust with a `?v=N` query — when you re-export an asset, we bump `N` (see *Rollout*). Don't rely on a fresh upload showing immediately without the bump. |
| **Must degrade to `alt` text** | On a 404 / text-only client, the browser shows the `alt` string. Each `alt` below is written to read as a **complete label on its own**. Ship the asset so the picture is a *bonus*, never load-bearing. |
| **Light + dark** | GitHub has both themes. Every asset ships a `-light.svg` and a `-dark.svg`; the renderer wraps them in `<picture>` with `prefers-color-scheme: dark`. Design both — don't assume a transparent background is enough (it isn't; strokes/wordmarks need different values per theme). |
| **Transparent background** | The comment background is `#ffffff` (light) / `#0d1117` (dark). Export transparent so the strip sits on the comment, not a card. |
| **Tiny** | Each SVG ≤ ~30 KB (strips), ≤ ~10 KB (icons). Run through SVGO with `removeViewBox: false`. |

---

## 1. Brand & palette (use these exact values)

The renderer's palette lives in [`action/src/render/lib/severity.ts`](../../action/src/render/lib/severity.ts).
Icons/strips **must** use these so imagery and the shields.io badges never disagree:

| Token | Hex | Used for |
|---|---|---|
| **Brand orange** | `#ff6b3d` | The Andy/Drift mark, accent rules, "▲" |
| Green (ship) | `#2ea043` | improvement · ship · tested |
| Amber (attention) | `#d29922` | mixed · monitor · to-address |
| Red (regression) | `#d1242f` | regression · act · untested |
| Blue (advisory) | `#58a6ff` | neutral / informational |
| Grey (flat) | `#8b949e` | muted / no-change |
| Surface light / dark | `#ffffff` / `#0d1117` | the comment background (design against these) |
| Ink light / dark | `#1f2328` / `#e6edf3` | body text on each theme |

**Type:** match the README's wordmark family (geometric/grotesque sans, e.g. the Inter/Söhne
feel). The literal "▲ Drift" mark stays brand orange. **Outline all text.**

---

## 2. The asset set

> **Filenames are a contract.** The renderer builds URLs from exactly these basenames under
> `https://raw.githubusercontent.com/refactorlab/andy/main/docs/report/`, appending `-light.svg`
> / `-dark.svg` and `?v=N`. Don't rename — match precisely (see
> [`action/src/render/lib/assets.ts`](../../action/src/render/lib/assets.ts)).

### 2.1 Section-title strips ⭐ (the core ask — "images of titles and sections")

Full-width banners that replace the plain `## 🏗 Architecture` text headings. The plain `##`
heading **stays directly under the image** as the accessible anchor + fallback, so the strip is
pure polish.

- **Canvas:** 1280 × 96 logical px, scales via `width="100%"`.
- **Layout:** left-aligned section icon + section label in the brand font, sitting on a thin
  (2 px) brand-orange `#ff6b3d` rule that runs the width. Generous left padding (~48 px).
- **Deliver:** light + dark for each of the seven sections below.

| Section id | Files (×2: `-light.svg` / `-dark.svg`) | Label on the strip | `alt` (degrade text — must match) | Icon motif |
|---|---|---|---|---|
| `guide` | `strip-guide-{light,dark}.svg` | Reviewer's guide | `Reviewer's guide` | 🧭 compass |
| `architecture` | `strip-architecture-{light,dark}.svg` | Architecture | `Architecture` | 🏗 nodes/graph |
| `value` | `strip-value-{light,dark}.svg` | Business value | `Business value` | 📊 bars |
| `suggestions` | `strip-suggestions-{light,dark}.svg` | Code suggestions | `Code suggestions` | ⚠️ / lightbulb |
| `blast_radius` | `strip-blast-radius-{light,dark}.svg` | Blast radius & coverage | `Blast radius & coverage` | 🎯 radiating target |
| `risks` | `strip-risks-{light,dark}.svg` | Risks | `Risks` | 🛰 quadrant grid |
| `extended` | `strip-extended-{light,dark}.svg` | Extended findings | `Extended findings` | 🧪 flask |

> **Wired today:** only `guide` is consumed in code right now (it leads the always-visible
> Reviewer's guide). The other six are defined and ready — wiring each is a one-line
> `sectionStrip('<id>')` call in its section renderer. Produce all seven; we'll light them up as
> the sections adopt them.

### 2.2 Brand banner (light/dark upgrade)

Today the header emits a single `docs/banner.svg`. Upgrade to a theme-aware pair so the report
header looks native in both themes — same treatment as the README hero.

- **Files:** `banner-light.svg`, `banner-dark.svg` (≈ 1280 × 200, `width="100%"`).
- **Content:** brand-orange "▲" mark + "**Andy** — PR Handoff by Drift" wordmark.
- **`alt`:** `Andy — PR Handoff by Drift`.
- *Note:* the header that embeds this is owner-managed; coordinate the swap with the maintainer.

### 2.3 Status-header strip (3 states × 2 themes)

A designed top-of-report status banner whose only variable is the label. The renderer picks one
by verdict.

- **Files:** `status-ship-{light,dark}.svg` (green), `status-attention-{light,dark}.svg` (amber),
  `status-regression-{light,dark}.svg` (red). 1280 × 72.
- **Content:** large status word + matching dot baked as vector (🟢/🟡/🔴 equivalents); brand
  wordmark right-aligned.
- **`alt`:** encode the state, e.g. `Status: attention — address before merge`.

### 2.4 Value-axis icon set

Replace the literal 💰👥⚙️🎨 in the value-card column headers with a consistent monochrome icon
set. (`currentColor` won't theme through an `<img>`, so ship per-theme fills.)

- **Files:** `axis-money-{light,dark}.svg`, `axis-customer-{light,dark}.svg`,
  `axis-runtime-{light,dark}.svg`, `axis-ux-{light,dark}.svg`. 24 × 24, 1px grid.
- **Color:** derive from the palette tokens above (so icons and badges match exactly).
- **`alt`:** the axis word — `money` / `customer` / `runtime` / `UX`. Emoji stays the fallback.

### 2.5 Legend / key image

One canonical key, shown once inside the footer's methodology disclosure, defining the whole
comment's palette + axis icons + the ⅛-block magnitude-bar glyph.

- **Files:** `legend-light.svg`, `legend-dark.svg`. ≈ 960 × 320.
- **Content:** tidy grid mapping each color/icon → meaning (ship/attention/regression/advisory/flat,
  the 4 axis icons, "filled block = magnitude").
- **`alt` (must match the renderer exactly):**
  `Drift legend — green: ship, amber: attention, red: regression, blue: advisory, grey: flat; money/customer/runtime/UX axis icons; filled block = magnitude`

### 2.6 Agent-ready badge logo (inline, no hosting)

Put the "▲" mark into the brand-orange `agent-ready: N fix prompts` shields.io badge via
`logo=data:image/svg+xml;base64,…` — so it needs **no hosting** and has **no 404 path**.

- **Deliver:** a single-path "▲" SVG, monochrome **white**, transparent, optimized **≤ 2 KB**
  (base64 must stay well under the shields URL limit). Provide the raw `.svg`; we encode it.

### 2.7 (Optional) Blast-radius "fuse" glyph sheet

Only if the ASCII "fuse" blast-radius visual graduates to a designed version. Small glyphs
(16–24 px): change-origin, tested node, untested node, lit-fuse, 💥. Light/dark. The ASCII version
is always the fallback, so these are pure upgrade.

---

## 3. README screenshots (the "generate screenshots" part)

The README references hero/bento/example screenshots under `docs/screenshots/`. To refresh those
with the **new** comment (now leading with the Reviewer's guide), capture:

1. **`reviewers-guide.png`** — the new 🧭 Reviewer's guide block: at-a-glance severity line, the
   ✅ Clean validations, the Focused-PR verdict, and the Key-issues table. *This is the new hero.*
2. **`comment-full.png`** — the whole sticky comment top-to-bottom on a real PR (banner → guide →
   value → suggestions → blast radius → risks → before-you-merge).
3. **`value-card.png`** and **`architecture.png`** — refresh the existing close-ups.

Shoot at **1280 px** content width, on a clean PR, both light and dark (`-light`/`-dark`), 2× DPI.

---

## 4. How the renderer consumes these (for your QA)

- All imagery is **gated by `DRIFT_REPORT_IMAGES`** and **OFF by default** — so a half-delivered
  set never ships broken images to reviewers. See
  [`assets.ts`](../../action/src/render/lib/assets.ts).
- Strips/legend render as `<p align="center"><picture><source …dark><img …light alt="…"></picture></p>`.
- The `?v=N` query is the Camo cache-buster (`ASSET_VERSION` in `assets.ts`).

---

## 5. Delivery checklist (acceptance criteria)

For **every** asset:

- [ ] Two files: `-light.svg` and `-dark.svg`, transparent background.
- [ ] Presentation attributes only — no `<style>`/`<script>`/`@import`; **text outlined to paths**.
- [ ] Renders correctly on `#ffffff` *and* `#0d1117`.
- [ ] Palette values exactly match §1.
- [ ] Filename matches §2 exactly (the renderer's URL contract).
- [ ] `alt` text matches the string in §2 / `assets.ts` exactly.
- [ ] Run through SVGO; strips ≤ 30 KB, icons ≤ 10 KB, badge logo ≤ 2 KB.
- [ ] Sanity-check in a GitHub comment **preview** (paste the `<picture>` snippet) before sign-off.

Drop the files in `refactorlab/andy:docs/report/`.

---

## 6. Rollout (after assets land)

1. Upload the files to `docs/report/` in `refactorlab/andy`.
2. Bump `ASSET_VERSION` in [`assets.ts`](../../action/src/render/lib/assets.ts) (cache-bust).
3. Enable imagery: set `DRIFT_REPORT_IMAGES=true` (action env / `with:` block, or per-run
   `/drift report-images=true`).
4. Open a test PR; confirm strips render in **both** themes and that toggling images off restores
   the clean text headings.
