# catalog-gen

Generate per-language JSON catalogs that map *package / module names*
to the seven `Category` labels used by `src/classify.rs`:

    Db, Network, Io, Cache, Queue, Log, Compute

Each output is a small JSON file (`catalogs/python.json`,
`catalogs/javascript.json`, …) that the Rust classifier embeds via
`include_str!`, replacing the hand-maintained `MODULE_CATALOG` constant.

## Where the data comes from

The deep research for this catalog mapped out every plausible source and
landed on a clear winner:

### 1. OpenTelemetry Registry — the primary source

`github.com/open-telemetry/opentelemetry.io/tree/main/data/registry`

It's **918 structured YAML files** — one per registered instrumentation —
with this shape:

```yaml
title: HTTPX
registryType: instrumentation
language: python
tags: [python, http, instrumentation]
package:
  registry: pypi
  name: opentelemetry-instrumentation-httpx
```

Three fields together give you everything:

- `language` — bucket the entry into the right language catalog.
- `tags` — the semantic category (`http`, `database`, `messaging`,
  `cache`, `logging`, …). These map almost 1:1 to your `Category` enum.
- `package.name` — strip the `opentelemetry-instrumentation-` prefix to
  recover the actual library being instrumented (`httpx`, `redis`, …).

Why this source wins:

- **Curated and CNCF-governed.** Every entry was reviewed in a PR.
- **Vendor-neutral.** Datadog, New Relic, Honeycomb, AWS all consume the
  same data; categories don't reflect any single vendor's bias.
- **Auto-updated monthly** by `@otelbot`. New libraries land automatically.
- **One git directory.** Single pass to scrape; no per-package HTTP calls.

### 2. opentelemetry-python-contrib `bootstrap_gen.py`

Auto-generated file at
[opentelemetry-python-contrib/.../bootstrap_gen.py](https://github.com/open-telemetry/opentelemetry-python-contrib/blob/main/opentelemetry-instrumentation/src/opentelemetry/instrumentation/bootstrap_gen.py).
Contains every Python library OTel's auto-instrumentation knows about,
as inline `{"library": ..., "instrumentation": ...}` records. We parse
this directly — it's the most authoritative Python list and updates
with every release.

### 3. Hand-curated seeds (`seeds/*.yaml`)

For things the upstream sources don't cover:

- **`seeds/rust.yaml`** — OTel-rust is sparse. Seeded from the de-facto
  Rust ecosystem (sqlx, diesel, reqwest, hyper, axum, tonic, tracing, …).
- **`seeds/scala.yaml`** — no upstream OTel project covers Scala. Seeded
  from the canonical Typelevel + Akka + Play stack (slick, doobie,
  akka.http, http4s, sttp, …).
- **`seeds/*_stdlib.yaml`** — Python/Java/Go/JS standard-library modules.
  OTel only catalogs third-party packages, but real source code imports
  `os`, `path`, `java.io`, `database/sql` constantly. We add them by hand.
- **`seeds/*_otel.yaml`** — snapshots of the OTel-derived data, for
  offline reproducibility. Refreshed by re-running the generator.

### Sources considered and rejected

| Source | Why not |
|---|---|
| PyPI Trove classifiers | Author-supplied, frequently missing or wrong. Requires per-package HTTP fetch (5000+ calls for any coverage). |
| npm package keywords | No taxonomy at all — free-form strings authors invent. |
| Maven Central categories | Stale, sparse, no JSON API. |
| Datadog `dd-trace-*` | Excellent curation but proprietary trademarks; structure varies by language. Useful for cross-check only. |
| Elastic APM agents | Same issue: high-quality lists but no machine-readable manifest. |
| libraries.io | Has categories but they're broad ("Frameworks") not semantic ("messaging"). |
| Snyk / OSV / Trivy | Focused on vulnerabilities, not functional purpose. |
| GitHub Topics / awesome-lists | Unstructured, no governance. |

## Architecture

```
                    ┌───────────────────────────────┐
                    │  OpenTelemetry Registry       │ ← primary, 918 YAMLs
  fetch (HTTP) ────► │  open-telemetry/opentelemetry │
                    │  .io/data/registry/*.yml      │
                    └────────────┬──────────────────┘
                                 │
   fetch (HTTP) ────► bootstrap_gen.py (python-contrib)
                                 │
   read (local)  ────► seeds/*.yaml  ← stdlib + Rust/Scala
                                 │
                                 ▼
                       ┌──────────────────┐
                       │  Categorizer     │   tags → Category
                       │  (regex rules)   │   via 30 prioritized regexes
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Dedup + sort    │
                       └────────┬─────────┘
                                │
                                ▼
                  catalogs/python.json   ─┐
                  catalogs/javascript.json│
                  catalogs/java.json      │ ← one JSON per language
                  catalogs/go.json        │
                  catalogs/rust.json      │
                  catalogs/scala.json    ─┘
```

## Two implementations, one behavior

This crate ships two parallel implementations of the same logic:

- **`src/main.rs`** — the Rust binary. ~740 lines. Build with `cargo build
  --release`. This is what you embed into your CI.
- **`generate.py`** — Python reference. Same regex set, same outputs.
  Useful when iterating on rules (no recompile loop) and for CI without a
  Rust toolchain.

Both have a `--self-test` mode that exercises the categorizer against 32
known mappings. Currently 32/32 passing on both.

## Running

### Rust

```bash
cd catalog-gen
cargo run --release --                          # default: ./catalogs from ./seeds
cargo run --release -- --offline                # seeds only
cargo run --release -- --self-test              # check the rules
cargo test                                      # unit tests
```

### Python

```bash
pip install pyyaml
python3 generate.py                             # full run
python3 generate.py --offline                   # seeds only
python3 generate.py --self-test                 # check the rules
```

## JSON output shape

```json
{
  "language": "python",
  "generated_at": "2026-05-12T07:22:34.567Z",
  "category_set": ["db", "network", "io", "cache", "queue", "log", "compute"],
  "sources": [
    "otel-python-contrib (embedded)",
    "seed/python_otel",
    "seed/python_stdlib"
  ],
  "count": 58,
  "entries": [
    { "module": "redis", "category": "cache", "source": "seed/python_otel" },
    { "module": "sqlalchemy", "category": "db", "source": "otel-python-contrib (embedded)" },
    { "module": "kafka", "category": "queue", "source": "otel-python-contrib (embedded)" }
  ]
}
```

Entries are deduped by `module` (first source wins) and sorted by
`(category, module)` for stable diffs.

## Plugging into `src/classify.rs`

Replace the giant `MODULE_CATALOG` constant with a build-time embedded load:

```rust
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize)]
struct CatalogFile {
    entries: Vec<CatalogEntry>,
}

#[derive(Deserialize)]
struct CatalogEntry {
    module: String,
    category: Category,        // Category already derives Deserialize
}

static CATALOG: OnceLock<Vec<(String, Category)>> = OnceLock::new();

fn catalog() -> &'static [(String, Category)] {
    CATALOG.get_or_init(|| {
        // Ship the JSON inside the binary at compile time.
        let files: &[&str] = &[
            include_str!("../catalogs/python.json"),
            include_str!("../catalogs/javascript.json"),
            include_str!("../catalogs/java.json"),
            include_str!("../catalogs/go.json"),
            include_str!("../catalogs/rust.json"),
            include_str!("../catalogs/scala.json"),
        ];
        let mut out = Vec::new();
        for raw in files {
            let f: CatalogFile = serde_json::from_str(raw)
                .expect("catalog json should parse");
            for e in f.entries {
                out.push((e.module, e.category));
            }
        }
        // Longest prefix wins for prefix-match: org.springframework.data
        // should match before a hypothetical broader org.springframework.
        out.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
        out
    })
}

pub fn classify_module(module: &str) -> Option<Category> {
    for (prefix, cat) in catalog() {
        if module == prefix
            || module.starts_with(&format!("{prefix}."))
            || module.starts_with(&format!("{prefix}/"))
            || module.starts_with(&format!("{prefix}::"))
        {
            return Some(*cat);
        }
    }
    None
}
```

`include_str!` keeps the binary single-file. If you want users to be able
to override without recompiling, swap in `std::fs::read_to_string` and
resolve a path from `$XDG_CONFIG_HOME` or similar.

Tier C (receiver patterns) and Tier D (unambiguous methods) in
`classify.rs` stay unchanged — they're heuristics about idiomatic naming,
not library-specific data, so they don't need to be data-driven.

## Coverage today

Counts from `--offline` (seeds + embedded bootstrap snapshot only;
running with network access against the live OTel registry will pull in
more):

| Language | Entries |
|---|---|
| Python | 58 |
| JavaScript | 41 |
| Java | 40 |
| Go | 28 |
| Rust | 34 |
| Scala | 17 |
| **Total** | **218** |

When run online against the OTel registry (~918 yaml files), the totals
grow substantially: Python gets ~80, JS/Java/Go each ~70+, Rust gets the
handful OTel-rust covers added on top of the seed. Scala stays seed-only.

## Refreshing

Schedule a monthly CI job:

```yaml
# .github/workflows/refresh-catalogs.yml
on:
  schedule: [{ cron: '0 6 1 * *' }]   # 1st of each month
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd catalog-gen && cargo run --release -- --out-dir ../catalogs
      - run: cargo test                # ensure classify.rs still works
      - uses: peter-evans/create-pull-request@v6
        with:
          title: "chore: refresh module catalogs from OTel registry"
          branch: refresh-catalogs
```

OTel releases instrumentation updates monthly. Anything not in the
registry yet is precisely the long tail where hand-curation in `seeds/`
is unavoidable anyway — and pull requests can add seed entries one line
at a time.
