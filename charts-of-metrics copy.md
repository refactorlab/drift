![LOW 0–39](https://img.shields.io/badge/LOW-0%E2%80%9339-22c55e?style=for-the-badge) ![MODERATE 40–59](https://img.shields.io/badge/MODERATE-40%E2%80%9359-eab308?style=for-the-badge) ![HIGH 60–79](https://img.shields.io/badge/HIGH-60%E2%80%9379-f97316?style=for-the-badge) ![CRITICAL 80–100](https://img.shields.io/badge/CRITICAL-80%E2%80%93100-ef4444?style=for-the-badge)

**LLM Context Limit:** ![FITS IN CONTEXT: NO (128k limit exceeded)](https://img.shields.io/badge/LLM_CONTEXT-EXCEEDED_134k_tokens-ef4444?style=for-the-badge)  
**Highest Complexity/Risk:** Blast radius (95) · Token footprint (92) · Context dependency (90) · Review fatigue risk (90)  
**Lowest Complexity/Risk:** Agent reviewability (28) · Observability (35)

---

## 1. LLM Complexity as a Metric
Evaluating AI-driven code review readiness. High structural entanglement or exceeding model context limits silently degrades automated reviews.

### Token footprint ![CRITICAL 92%](https://img.shields.io/badge/CRITICAL-92%25%20%E2%86%91-ef4444?style=for-the-badge)

![Token footprint gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B92%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B8%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">How many tokens does this PR consume when fed to a model? Direct proxy for **how hard is this to reason about automatically** (PR #156 consumes **134k tokens**).</font>
</details>

---

### Context window pressure ![CRITICAL 88%](https://img.shields.io/badge/CRITICAL-88%25%20%E2%86%91-ef4444?style=for-the-badge)

![Context window pressure gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B88%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B12%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Does the full diff fit in a single context window, or does it need chunking? Chunking results in a **loss of semantic coherence** and **missed cross-file coupling issues**.</font>
</details>

---

### Agent reviewability ![CRITICAL 28%](https://img.shields.io/badge/CRITICAL-28%25%20%E2%86%93-ef4444?style=for-the-badge)
*Higher is better*

![Agent reviewability gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B28%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B72%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Can an LLM actually give useful feedback on this, or is it **too large and tangled to reason about reliably**? At 28, the codebase changes are **highly interdependent**.</font>
</details>

---

### Semantic density ![HIGH 78%](https://img.shields.io/badge/HIGH-78%25%20%E2%86%91-f97316?style=for-the-badge)

![Semantic density gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B78%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B22%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Tokens per logical change, representing semantic concentration. Distinguishes between **heavy boilerplate** and **dense, complex business logic**.</font>
</details>

---

## 2. Comprehensibility
Human readability, cognitive load, and engineering transparency.

### Explainability score ![HIGH 40%](https://img.shields.io/badge/HIGH-40%25%20%E2%86%93-f97316?style=for-the-badge)
*Higher is better*

![Explainability score gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B40%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B60%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Can an engineer unfamiliar with this codebase understand the change **without asking someone**? Measured via comment density, function naming clarity, and control flow simplicity.</font>
</details>

---

### Context dependency ![CRITICAL 90%](https://img.shields.io/badge/CRITICAL-90%25%20%E2%86%91-ef4444?style=for-the-badge)

![Context dependency gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B90%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B10%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">How much prior knowledge is required to review this PR? Evaluates whether the diff touches **highly coupled core abstractions** or **isolated modules**.</font>
</details>

---

### Decision transparency ![MODERATE 45%](https://img.shields.io/badge/MODERATE-45%25%20%E2%86%93-eab308?style=for-the-badge)
*Higher is better*

![Decision transparency gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B45%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%20%5B%27%23000000%27%2C%27%23eab308%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B55%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Are **non-obvious engineering choices explained** in comments or PR documentation? (e.g., choice of a specific algorithm, rationale behind a magic number).</font>
</details>

---

## 3. Longevity
Code health, technical debt impact, and long-term maintainability.

### Maintenance burden ![HIGH 70%](https://img.shields.io/badge/HIGH-70%25%20%E2%86%91-f97316?style=for-the-badge)

![Maintenance burden gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B70%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B30%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">How much will this code need to be **touched again in the future**? Proxy: architectural coupling score, number of hardcoded configurations, and TODO density.</font>
</details>

---

### Debt introduced vs. resolved ![HIGH 75%](https://img.shields.io/badge/HIGH-75%25%20%E2%86%91-f97316?style=for-the-badge)

![Debt introduced vs. resolved gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B75%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%20%5B%27%23000000%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B25%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Net technical debt delta resulting from this PR. High scores indicate that we are **introducing significant architectural complexities** relative to what we are cleaning up.</font>
</details>

---

### Fragility index ![CRITICAL 85%](https://img.shields.io/badge/CRITICAL-85%25%20%E2%86%91-ef4444?style=for-the-badge)

![Fragility index gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B85%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B15%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">How many other components or call sites **quietly break if this code changes**? Measures high fan-out coupling and downstream dependencies.</font>
</details>

---

## 4. Correctness Confidence
Test coverage, isolation of side effects, and edge case safety.

### Test coverage (changed lines) ![MODERATE 55%](https://img.shields.io/badge/MODERATE-55%25%20%E2%86%91-eab308?style=for-the-badge)
*Higher is better*

![Test coverage (changed lines) gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B55%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23eab308%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B45%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Not the overall codebase coverage, but specifically the **test coverage of the lines changed or added** in this PR.</font>
</details>

---

### Repeatability ![MODERATE 50%](https://img.shields.io/badge/MODERATE-50%25%20%E2%86%93-eab308?style=for-the-badge)
*Higher is better*

![Repeatability gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B50%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%20%5B%27%23000000%27%2C%27%23eab308%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B50%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Are side effects **fully isolated and deterministic**? Measures whether you can run this code twice and guarantee identical results under identical conditions.</font>
</details>

---

### Edge case surface ![HIGH 75%](https://img.shields.io/badge/HIGH-75%25%20%E2%86%91-f97316?style=for-the-badge)

![Edge case surface gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B75%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23f97316%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B25%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">The volume of implicit inputs or state assumptions this code makes. High surface means many **boundary or failure conditions exist** that are easy to overlook.</font>
</details>

---

## 5. Operational
Post-deployment stability, operability, and rollback capability.

### Rollback complexity ![CRITICAL 80%](https://img.shields.io/badge/CRITICAL-80%25%20%E2%86%91-ef4444?style=for-the-badge)

![Rollback complexity gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B80%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B20%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">If this release fails in production, **how difficult is the rollback**? High scores reflect deep database migrations, API changes, or stateful data transformations.</font>
</details>

---

### Observability ![CRITICAL 35%](https://img.shields.io/badge/CRITICAL-35%25%20%E2%86%93-ef4444?style=for-the-badge)
*Higher is better*

![Observability gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B35%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%20%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B65%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Does this change add necessary logging, metrics, or custom tracing spans, or does it **introduce an operational blind spot** in the production services?</font>
</details>

---

### Blast radius ![CRITICAL 95%](https://img.shields.io/badge/CRITICAL-95%25%20%E2%86%91-ef4444?style=for-the-badge)

![Blast radius gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B95%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B5%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">PR #156's changes propagate across **nearly the entire codebase**. A defect introduced here has the widest possible surface for cascading failures.</font>
</details>

---

## 6. Team & Process
Organizational dynamics and review safety.

### Knowledge concentration ![CRITICAL 82%](https://img.shields.io/badge/CRITICAL-82%25%20%E2%86%91-ef4444?style=for-the-badge)

![Knowledge concentration gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B82%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B18%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">Bus factor delta: Is only **one specific engineer capable** of reviewing and maintaining these changes? High scores represent high organizational risk.</font>
</details>

---

### Review fatigue risk ![CRITICAL 90%](https://img.shields.io/badge/CRITICAL-90%25%20%E2%86%91-ef4444?style=for-the-badge)

![Review fatigue risk gauge](https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B90%5D%2CbackgroundColor%3AgetGradientFillHelper%28%27horizontal%27%2C%5B%27%23000000%27%2C%27%23ef4444%27%5D%29%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%2C%7Bdata%3A%5B10%5D%2CbackgroundColor%3A%27%2322252a%27%2CborderRadius%3A3%2CborderSkipped%3Afalse%2CbarThickness%3A6%7D%5D%7D%2Coptions%3A%7BindexAxis%3A%27y%27%2Clayout%3A%7Bpadding%3A0%7D%2Cscales%3A%7Bx%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%2Cmin%3A0%2Cmax%3A100%7D%2Cy%3A%7Bstacked%3Atrue%2Cdisplay%3Afalse%7D%7D%2Cplugins%3A%7Blegend%3A%7Bdisplay%3Afalse%7D%7D%7D%7D)

<details>
<summary>Description & Analysis</summary>

<font face="monospace">53 files changed across a core abstraction layer. Reviewers are likely to miss issues in the **latter half of the diff** due to attention saturation.</font>
</details>

---

<details>
<summary>Reading the scale</summary>
**Reading the scale** — Colour and length track the raw 0–100 score (green → low, red → high). 
 * **Lower is better** for most risk metrics (e.g. blast radius, token footprint, maintenance burden).
 * **Higher is better** for quality metrics flagged *"higher is better"* (Agent reviewability, Explainability score, Decision transparency, Repeatability, Observability, Test coverage). For these quality metrics, a low score (green) represents a sub-optimal/deficient state, whereas a high score (red) represents optimal quality.
</details>

---

![Full metric profile radar](https://quickchart.io/chart?bkg=%230d0d10&w=1000&h=720&v=2&c=%7B%0A%20%20type%3A%20%27radar%27%2C%0A%20%20data%3A%20%7B%0A%20%20%20%20labels%3A%20%5B%0A%20%20%20%20%20%20%27Token%20footprint%27%2C%0A%20%20%20%20%20%20%27Context%20window%20pressure%27%2C%0A%20%20%20%20%20%20%27Agent%20reviewability%27%2C%0A%20%20%20%20%20%20%27Semantic%20density%27%2C%0A%20%20%20%20%20%20%27Explainability%27%2C%0A%20%20%20%20%20%20%27Context%20dependency%27%2C%0A%20%20%20%20%20%20%27Maintenance%20burden%27%2C%0A%20%20%20%20%20%20%27Fragility%20index%27%2C%0A%20%20%20%20%20%20%27Test%20coverage%27%2C%0A%20%20%20%20%20%20%27Edge%20case%20surface%27%2C%0A%20%20%20%20%20%20%27Rollback%20complexity%27%2C%0A%20%20%20%20%20%20%27Blast%20radius%27%2C%0A%20%20%20%20%20%20%27Knowledge%20concentration%27%2C%0A%20%20%20%20%20%20%27Review%20fatigue%20risk%27%0A%20%20%20%20%5D%2C%0A%20%20%20%20datasets%3A%20%5B%0A%20%20%20%20%20%20%7B%0A%20%20%20%20%20%20%20%20label%3A%20%27PR%20%23142%20-%20small%20bugfix%27%2C%0A%20%20%20%20%20%20%20%20backgroundColor%3A%20%27rgba%28232%2C112%2C70%2C0.12%29%27%2C%0A%20%20%20%20%20%20%20%20borderColor%3A%20%27rgb%28232%2C112%2C70%29%27%2C%0A%20%20%20%20%20%20%20%20pointBackgroundColor%3A%20%27rgb%28232%2C112%2C70%29%27%2C%0A%20%20%20%20%20%20%20%20pointBorderColor%3A%20%27rgb%28232%2C112%2C70%29%27%2C%0A%20%20%20%20%20%20%20%20borderWidth%3A%202%2C%0A%20%20%20%20%20%20%20%20borderDash%3A%20%5B6%2C6%5D%2C%0A%20%20%20%20%20%20%20%20pointRadius%3A%203%2C%0A%20%20%20%20%20%20%20%20data%3A%20%5B22%2C%2012%2C%2047%2C%2030%2C%2050%2C%2022%2C%2014%2C%2013%2C%2062%2C%2015%2C%2010%2C%2022%2C%2015%2C%2020%5D%0A%20%20%20%20%20%20%7D%2C%0A%20%20%20%20%20%20%7B%0A%20%20%20%20%20%20%20%20label%3A%20%27PR%20%23156%20-%20core%20abstraction%20refactor%27%2C%0A%20%20%20%20%20%20%20%20backgroundColor%3A%20%27rgba%2879%2C142%2C230%2C0.18%29%27%2C%0A%20%20%20%20%20%20%20%20borderColor%3A%20%27rgb%2879%2C142%2C230%29%27%2C%0A%20%20%20%20%20%20%20%20pointBackgroundColor%3A%20%27rgb%2879%2C142%2C230%29%27%2C%0A%20%20%20%20%20%20%20%20pointBorderColor%3A%20%27rgb%2879%2C142%2C230%29%27%2C%0A%20%20%20%20%20%20%20%20borderWidth%3A%202%2C%0A%20%20%20%20%20%20%20%20pointRadius%3A%203%2C%0A%20%20%20%20%20%20%20%20data%3A%20%5B95%2C%2080%2C%2030%2C%2042%2C%2030%2C%2072%2C%2055%2C%2075%2C%2030%2C%2050%2C%2048%2C%2078%2C%2062%2C%2082%5D%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%5D%0A%20%20%7D%2C%0A%20%20options%3A%20%7B%0A%20%20%20%20legend%3A%20%7B%0A%20%20%20%20%20%20position%3A%20%27top%27%2C%0A%20%20%20%20%20%20labels%3A%20%7B%20fontColor%3A%20%27%23c8ccd2%27%2C%20fontSize%3A%2013%2C%20usePointStyle%3A%20true%20%7D%0A%20%20%20%20%7D%2C%0A%20%20%20%20scale%3A%20%7B%0A%20%20%20%20%20%20ticks%3A%20%7B%0A%20%20%20%20%20%20%20%20min%3A%200%2C%0A%20%20%20%20%20%20%20%20max%3A%20100%2C%0A%20%20%20%20%20%20%20%20stepSize%3A%2025%2C%0A%20%20%20%20%20%20%20%20backdropColor%3A%20%27rgba%280%2C0%2C0%2C0%29%27%2C%0A%20%20%20%20%20%20%20%20fontColor%3A%20%27%237a7f87%27%0A%20%20%20%20%20%20%7D%2C%0A%20%20%20%20%20%20gridLines%3A%20%7B%20color%3A%20%27rgba%28255%2C255%2C255%2C0.07%29%27%20%7D%2C%0A%20%20%20%20%20%20angleLines%3A%20%7B%20color%3A%20%27rgba%28255%2C255%2C255%2C0.07%29%27%20%7D%2C%0A%20%20%20%20%20%20pointLabels%3A%20%7B%20fontColor%3A%20%27%239aa0a6%27%2C%20fontSize%3A%2013%20%7D%0A%20%20%20%20%7D%0A%20%20%7D%0A%7D)