# PR #156 — Complexity Gauges

Per-metric complexity scores for this PR. Each bar fills to the metric's score out of 100 on a dark track; the status pill repeats the exact value with an arrow for direction.

![LOW 0–39](https://img.shields.io/badge/LOW-0%E2%80%9339-22c55e?style=for-the-badge) ![MODERATE 40–59](https://img.shields.io/badge/MODERATE-40%E2%80%9359-eab308?style=for-the-badge) ![HIGH 60–79](https://img.shields.io/badge/HIGH-60%E2%80%9379-f97316?style=for-the-badge) ![CRITICAL 80–100](https://img.shields.io/badge/CRITICAL-80%E2%80%93100-ef4444?style=for-the-badge)

**Highest:** Blast radius (95) · Token footprint (92) · Context dependency (90)  
**Lowest:** Agent reviewability (28)

---

## Context & cost

### Token footprint ![CRITICAL 92%](https://img.shields.io/badge/CRITICAL-92%25%20%E2%86%91-ef4444?style=for-the-badge)

![Token footprint gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B92%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B8%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

About 92% of the prompt budget is consumed before reasoning begins, leaving little headroom for follow-up turns or large diffs.

---

### Context dependency ![CRITICAL 90%](https://img.shields.io/badge/CRITICAL-90%25%20%E2%86%91-ef4444?style=for-the-badge)

![Context dependency gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B90%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B10%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Understanding the change requires loading large amounts of surrounding code and prior decisions.

---

### Context window pressure ![CRITICAL 88%](https://img.shields.io/badge/CRITICAL-88%25%20%E2%86%91-ef4444?style=for-the-badge)

![Context window pressure gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B88%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B12%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

The refactor touches so many interdependencies that reviewers must hold an unusually large mental model simultaneously — driving fatigue and error rates up.

---

### Semantic density ![HIGH 78%](https://img.shields.io/badge/HIGH-78%25%20%E2%86%91-f97316?style=for-the-badge)

![Semantic density gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B78%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23c2410c%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B22%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Each changed line packs a lot of meaning, so small edits carry outsized intent and are easy to misread.

---

## Reviewability & clarity

### Review fatigue risk ![CRITICAL 90%](https://img.shields.io/badge/CRITICAL-90%25%20%E2%86%91-ef4444?style=for-the-badge)

![Review fatigue risk gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B90%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B10%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

53 files changed across a core abstraction layer. Reviewers are likely to miss issues in the latter half of the diff due to attention saturation.

---

### Explainability score ![MODERATE 40%](https://img.shields.io/badge/MODERATE-40%25%20%E2%86%93-eab308?style=for-the-badge)

![Explainability score gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B40%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23a16207%27%2C%27%23eab308%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B60%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Higher is better here — at 40, less than half of the changes explain themselves from the diff alone; the rest need external context to follow.

---

### Agent reviewability ![LOW 28%](https://img.shields.io/badge/LOW-28%25%20%E2%86%93-22c55e?style=for-the-badge)

![Agent reviewability gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B28%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%2315803d%27%2C%27%2322c55e%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B72%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Higher is better here — at 28, the diff is hard for an automated agent to reason about in isolation, and most of it needs broader context.

---

## Risk & stability

### Blast radius ![CRITICAL 95%](https://img.shields.io/badge/CRITICAL-95%25%20%E2%86%91-ef4444?style=for-the-badge)

![Blast radius gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B95%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B5%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

PR #156's changes propagate across nearly the entire codebase. A defect introduced here has the widest possible surface for cascading failures.

---

### Fragility index ![CRITICAL 85%](https://img.shields.io/badge/CRITICAL-85%25%20%E2%86%91-ef4444?style=for-the-badge)

![Fragility index gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B85%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B15%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Many call sites rely on invariants that an innocent-looking edit could quietly break.

---

### Knowledge concentration ![CRITICAL 82%](https://img.shields.io/badge/CRITICAL-82%25%20%E2%86%91-ef4444?style=for-the-badge)

![Knowledge concentration gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B82%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B18%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Understanding rests heavily on a small number of people, raising bus-factor risk.

---

### Rollback complexity ![CRITICAL 80%](https://img.shields.io/badge/CRITICAL-80%25%20%E2%86%91-ef4444?style=for-the-badge)

![Rollback complexity gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B80%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23b91c1c%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B20%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Reverting cleanly is hard because the change is entangled with data and adjacent features.

---

### Edge case surface ![HIGH 75%](https://img.shields.io/badge/HIGH-75%25%20%E2%86%91-f97316?style=for-the-badge)

![Edge case surface gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B75%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23c2410c%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B25%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

The change opens a wide range of boundary and failure conditions that are easy to overlook.

---

### Maintenance burden ![HIGH 70%](https://img.shields.io/badge/HIGH-70%25%20%E2%86%91-f97316?style=for-the-badge)

![Maintenance burden gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B70%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23c2410c%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B30%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

The shape of the code noticeably raises the ongoing cost of keeping it correct as the system evolves.

---

### Test coverage (changed lines) ![MODERATE 55%](https://img.shields.io/badge/MODERATE-55%25%20%E2%86%91-eab308?style=for-the-badge)

![Test coverage (changed lines) gauge](https://quickchart.io/chart?w=160&h=72&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B55%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23a16207%27%2C%27%23eab308%27%5D%29%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%2C%7Bdata%3A%5B45%5D%2CbackgroundColor%3A%27%232b2f36%27%2CborderRadius%3A6%2CborderSkipped%3Afalse%2CbarThickness%3A22%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A%7Btop%3A8%2Cright%3A10%2Cbottom%3A8%2Cleft%3A10%7D%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

Higher is better here — at 55, roughly half of the changed lines are exercised by tests, leaving the remainder unguarded.

---

> **Reading the scale** — colour and length track the raw 0–100 score (green → low, red → high). For the three quality metrics flagged *"higher is better"* (Agent reviewability, Explainability score, Test coverage) a higher score is the desirable direction; for every other metric, lower is better.