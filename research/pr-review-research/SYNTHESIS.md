# The Anatomy of a High-Value PR Review

*Distilled from the merged, post-2024 pull requests in [`prs/`](prs/) — drawn from the most-reacted and most-discussed PRs across Rust, Node.js, TypeScript, Bitcoin, Kubernetes, React, Vue, Svelte, Deno and CPython.*

The headline finding, stated up front: **reaction count and comment count measure attention, not quality.** The single most-reacted comment in a thread is often a one-liner of celebration or outrage. The comments that actually *changed a decision or unblocked a merge* usually sit lower in the reaction ranking and follow a small set of repeatable shapes. This document extracts those shapes from real, recent, merged PRs.

---

## 1. The seven shapes of a valuable review comment

Every genuinely useful comment in this corpus is one of these:

| Shape | What it does | Example in this corpus |
|---|---|---|
| **The Structured Signal** | A reasoned `Concept ACK` / `Concept NACK` / `Approach NACK` that separates *idea* from *approach* from *code*. | `BitcoinMechanic` / `Sjors` on uncapping datacarrier ([#04](prs/04-bitcoin-bitcoin-32406.md)); `josibake` decoding "Concept ACK, Approach NACK" ([#16](prs/16-bitcoin-bitcoin-30595.md)) |
| **The "Should This Exist?"** | Steps back from correctness to question whether the feature belongs here at all, weighing benefit vs. perpetual maintenance. | `MylesBorins`: *"the project needs to seriously consider if it wants to take on this functionality and the benefit it provides"* ([#02](prs/02-nodejs-node-52190.md)) |
| **The Measured Number** | Brings before/after benchmarks (ideally independent, with hardware) instead of asserting performance. | `Voultapher`'s cross-machine sort benchmarks ([#01](prs/01-rust-lang-rust-124032.md)); `transitive-bullshit`'s independent reactivity benchmark ([#14](prs/14-vuejs-core-12349.md)); `Andarist`'s real-repo type-check numbers ([#09](prs/09-microsoft-typescript-61505.md)) |
| **The Root-Cause Analysis** | Explains *why* something is slow/broken at a mechanistic level — and whether the fix bends the actual curve. | `ahejlsberg`: *"we enter into an exponential expansion when instantiating deeply nested types… caching cuts the number in half, but that doesn't help much against exponential growth"* ([#09](prs/09-microsoft-typescript-61505.md)) |
| **The Mechanism Proposal** | Doesn't just flag a problem — proposes the concrete implementation, or an alternative API. | `jakebailey`: *"introduce a flow node at each return, which just walks back to every preceding node"* ([#03](prs/03-microsoft-typescript-56941.md)); `levibassey`'s `{#boundary}`/`{#try}` alternative ([#06](prs/06-sveltejs-svelte-14211.md)) |
| **The Reproduce-and-Patch** | Reproduces the behavior locally and hands the author a ready-to-apply diff. | `odinuge` reproduces with a manifest, `ffromani` posts the fixing diff ([#05](prs/05-kubernetes-kubernetes-127525.md)) |
| **The Thread Summary** | Consolidates a long, branching discussion into a single decidable statement. | `michaelfaith` summarizing the flat-config debate before the API converges ([#11](prs/11-facebook-react-30774.md)) |

If a comment isn't doing one of these seven things, it's probably agreement, disagreement, or celebration. Those have social value — but they aren't *review*.

---

## 2. Altitude: the most valuable question is rarely "is the code correct?"

The recurring pattern across the best threads is that senior reviewers operate **above** the diff:

- **"Should this exist here?"** — Node's `--run` thread ([#02](prs/02-nodejs-node-52190.md)) barely discusses the implementation; it debates whether a script-runner belongs in core at all, and whether a 200ms speedup justifies permanent surface area. `fabiospampinato`: *"Do our users care if it takes 200ms or 40ms?"*
- **"Who else does this touch?"** — On the Rust sort replacement ([#01](prs/01-rust-lang-rust-124032.md)), `Kobzol` immediately connects the change to an adjacent `optimize-for-size` stakeholder.
- **"Does the fix bend the curve?"** — On the TypeScript perf PR ([#09](prs/09-microsoft-typescript-61505.md)), the review pushes past "it's faster now" to ask whether halving an *exponential* cost is actually a fix.
- **"What's the rollout?"** — On async-closures stabilization ([#08](prs/08-rust-lang-rust-132706.md)), `joshtriplett` turns the thread toward the announcement blog post and migration story, not the code.

Correctness review is table stakes. The comments that earned respect reframed the *decision*.

---

## 3. The structural template for a long-form review (especially a dissent)

The highest-stakes threads — Bitcoin governance, Rust stabilizations — show the same skeleton in their most-respected comments:

1. **Declare your standing.** `DanielRosenwasser`: *"I work on the TypeScript team and wanted to provide our perspective"* ([#12](prs/12-nodejs-node-53725.md)). Telling readers which hat you wear raises the signal of everything that follows.
2. **Signal concept vs. approach.** Bitcoin's protocol is explicit about this — *Concept NACK* (I disagree with the idea) is a different message from *Approach NACK* (I like the idea, not this implementation) ([#04](prs/04-bitcoin-bitcoin-32406.md), [#16](prs/16-bitcoin-bitcoin-30595.md)). Make the *level* of your objection unambiguous.
3. **Argue from the user / incentives, not from taste.** `BitcoinMechanic` grounds a NACK in node-operator incentives, not aesthetics.
4. **Bring evidence.** Reproduce it, benchmark it, link the failing test. `panva` / `enricopolanski` supply concrete module-resolution failure cases ([#12](prs/12-nodejs-node-53725.md)); `fatcerberus` a minimal breaking repro ([#13](prs/13-microsoft-typescript-57465.md)).
5. **Leave a decidable conclusion.** A clear ask — merge, revert, change-then-merge — not an open-ended grievance.

---

## 4. Tone: what actually correlates with influence

- **Fence the scope, kindly but firmly.** `RalfJung`: *"This is an MVP. Please do not flood this PR with all your wildest reflection dreams. Anything that suggests to extend the scope of this PR is off-topic."* ([#10](prs/10-rust-lang-rust-146923.md)) Explicitly saying what a PR is *not* about is a gift to everyone reading.
- **One verifiable fact beats a paragraph of worry.** The threads that converged fastest replaced opinion with a number, a repro, or a spec citation.
- **Close the loop and give credit.** `poteto` ships an RC and thanks the contributor by name ([#11](prs/11-facebook-react-30774.md)); `ffromani` commits to a specific release cycle ([#05](prs/05-kubernetes-kubernetes-127525.md)). Review is a relationship, not a verdict.
- **Disagree on the conclusion, agree on the values.** The most persuasive dissents establish shared ground before diverging.

---

## 5. What the *author* can do to earn a great review

The PRs that attracted high-quality review also made themselves reviewable:

- **Write a structured requirements/decision frame in the description.** `benbucksch`'s requirements spec for error handling ([#06](prs/06-sveltejs-svelte-14211.md)) gave reviewers a rubric to argue against.
- **Verify your own claims against real builds.** `gabritto` packaging an installable `.tgz` so others can test the actual behavior ([#03](prs/03-microsoft-typescript-56941.md)).
- **Bring the numbers yourself.** `Voultapher` posting microbenchmarks the moment they're requested ([#01](prs/01-rust-lang-rust-124032.md)).
- **Connect to the ecosystem.** `eps1lon` flagging the downstream Next.js version dependency on a React hook ([#07](prs/07-facebook-react-28491.md)).

---

## 6. When *not* to read into the numbers

- **The most-reacted comment is often not the most valuable.** On the Kubernetes static-placement fix ([#05](prs/05-kubernetes-kubernetes-127525.md)), the genuinely useful comments — a local repro and a ready patch — carry **one** reaction each. The reproduce-and-patch work is invisible to the reaction count.
- **Reactions can measure dissent, not approval.** On the Bitcoin datacarrier PR ([#04](prs/04-bitcoin-bitcoin-32406.md)), the top-reacted comments are *NACKs*. High 👍 ≠ consensus to merge; read the *sign* of the signal.
- **Inline review is where the real work often is.** Several PRs here have far more inline review comments than conversation comments (Kubernetes #05: 141 inline; Bitcoin #16: 313 inline). The headline thread is the tip; the diff-anchored review is the iceberg.

---

## 7. The one-paragraph checklist

> Before you submit a review comment, make sure it's one of the seven shapes (structured signal, should-this-exist, measured number, root-cause, mechanism proposal, reproduce-and-patch, thread summary). Operate **above the diff** when you can — ask whether the change should exist, who it touches, whether the fix bends the curve, and what the rollout is. If you're dissenting: declare your standing, signal concept-vs-approach, argue from users/incentives, bring evidence, and leave a decidable ask. Prefer one verifiable fact over a paragraph of worry, fence the scope, close the loop, and give credit. If you're the author: frame the decision in the description, verify your own claims against real builds, bring the numbers, and connect the change to the ecosystem.

---

*See [README.md](README.md) for the full index and methodology. Every quote above is verbatim from the linked PR file, pulled from the GitHub REST API with real reaction counts. All PRs are merged and opened in 2024 or later.*
