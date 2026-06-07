# What Makes a High-Value Pull-Request Review — A Study of Recent Landmark PRs

> Field research collecting **16 merged, post-2024 pull requests** from the biggest open-source repositories on GitHub — each with the *actual verbatim review comments* and an analysis of **why** the review was valuable.

Every PR here is **merged** and **opened in 2024 or later**. Every quoted comment is pulled live from the GitHub REST API with its real reaction counts — nothing is paraphrased. Built as a reference for writing better PR reviews.

## 📑 Start here

- **[INDEX.md](INDEX.md)** — master index of the **whole corpus** (160+ PR files across curated, parallel-workflow, and auto-collected sources).
- **[SYNTHESIS.md](SYNTHESIS.md)** — the patterns distilled: the shapes a valuable review comment takes, the template the best long-form reviews follow, and what *not* to read into reaction counts.
- **[WEB-RESEARCH.md](WEB-RESEARCH.md)** — a further **20 PRs** selected purely for *valuable review prose* (Swift/Django/ESLint/Symfony/Pydantic/Zed…), collected via web fetch of the public PR pages (no API token).

This file indexes the **16** API-sourced PRs below; the web batch is indexed separately in WEB-RESEARCH.md.

## The 16 PRs

"Top 💬" = reactions on the single most-reacted *human* comment in the thread (bots/CI filtered out).

| # | Repo | PR | Title | Opened | 💬 conv | 🔍 inline | Top 💬 |
|---|------|----|-------|--------|--------:|---------:|-------:|
| 01 | rust-lang/rust | [#124032](prs/01-rust-lang-rust-124032.md) | Replace sort implementations | 2024-04-16 | 108 | 35 | 8 |
| 02 | nodejs/node | [#52190](prs/02-nodejs-node-52190.md) | cli: implement `node --run <script-in-package… | 2024-03-22 | 104 | 100 | 32 |
| 03 | microsoft/TypeScript | [#56941](prs/03-microsoft-typescript-56941.md) | Narrow generic conditional and indexed access… | 2024-01-03 | 102 | 45 | 8 |
| 04 | bitcoin/bitcoin | [#32406](prs/04-bitcoin-bitcoin-32406.md) | policy: uncap datacarrier by default | 2025-05-02 | 164 | 81 | 88 |
| 05 | kubernetes/kubernetes | [#127525](prs/05-kubernetes-kubernetes-127525.md) | fix: pods meeting qualifications for static p… | 2024-09-21 | 104 | 141 | 1 |
| 06 | sveltejs/svelte | [#14211](prs/06-sveltejs-svelte-14211.md) | feat: add error boundaries | 2024-11-07 | 48 | 23 | 10 |
| 07 | facebook/react | [#28491](prs/07-facebook-react-28491.md) | Add `React.useActionState` | 2024-03-05 | 32 | 8 | 8 |
| 08 | rust-lang/rust | [#132706](prs/08-rust-lang-rust-132706.md) | Stabilize async closures (RFC 3668) | 2024-11-06 | 30 | 3 | 15 |
| 09 | microsoft/TypeScript | [#61505](prs/09-microsoft-typescript-61505.md) | Cache mapper instantiations | 2025-03-30 | 68 | 3 | 71 |
| 10 | rust-lang/rust | [#146923](prs/10-rust-lang-rust-146923.md) | Reflection MVP | 2025-09-23 | 49 | 52 | 18 |
| 11 | facebook/react | [#30774](prs/11-facebook-react-30774.md) | feat(eslint-plugin-react-hooks): support flat… | 2024-08-21 | 54 | 7 | 23 |
| 12 | nodejs/node | [#53725](prs/12-nodejs-node-53725.md) | module: add --experimental-strip-types | 2024-07-04 | 144 | 117 | 30 |
| 13 | microsoft/TypeScript | [#57465](prs/13-microsoft-typescript-57465.md) | Infer type predicates from function bodies us… | 2024-02-21 | 141 | 28 | 19 |
| 14 | vuejs/core | [#12349](prs/14-vuejs-core-12349.md) | perf(reactivity): ports `alien-signals` 0.4.4 | 2024-11-09 | 46 | 0 | 71 |
| 15 | sveltejs/svelte | [#15000](prs/15-sveltejs-svelte-15000.md) | feat: attachments | 2025-01-13 | 216 | 11 | 24 |
| 16 | bitcoin/bitcoin | [#30595](prs/16-bitcoin-bitcoin-30595.md) | kernel: Introduce C header API | 2024-08-06 | 144 | 313 | 11 |

## What "valuable" looks like across this set

The PRs were chosen to span the full range of high-value review, all from repos with strong review cultures:

- **Structured governance review** — Bitcoin's `Concept ACK` / `Concept NACK` protocol on uncapping datacarrier (#04) and the kernel C API (#16).
- **Evidence-based perf review** — Rust's sort-algorithm replacement benchmarks (#01); TypeScript's exponential-instantiation root-cause analysis (#09); Vue's independent third-party benchmark (#14).
- **"Should this exist?" altitude** — Node's `--run` thread weighing a feature's benefit against maintenance cost (#02).
- **Mechanism-proposing review** — TypeScript flow-node design (#03); reproduce-and-patch in Kubernetes (#05).
- **Cross-cutting lenses** — React `useActionState` connecting web-platform semantics, downstream releases, and learnability (#07).
- **Design-in-the-open** — Svelte error boundaries (#06) and attachments (#15) debating ergonomics and alternative APIs.
- **Scope & rollout discipline** — Rust's Reflection MVP scope fence (#10) and async-closures rollout planning (#08); React ESLint flat-config thread summary (#11).

## Methodology & caveats

- Candidates found objectively via `GET /search/issues?q=repo:<r>+is:pr+is:merged+created:>=2024-01-01&sort=reactions|comments`.
- Per-PR data via `GET /repos/{o}/{r}/pulls/{n}` + `GET /repos/{o}/{r}/issues/{n}/comments?per_page=100` (reactions included by default).
- Comments ranked by **total reaction count**; bot / CI accounts (bors, rust-timer, codecov, …) filtered out of the ranking.
- Threads with ≥100 comments show only the first page (unauthenticated API budget) and carry a ⚠️ note — "most-liked comment" is best-effort within that window.
- Reaction counts are a snapshot at collection time and will drift.
