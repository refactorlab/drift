# cockroachdb/cockroach #165577 — storage: add MultiEngineCompactionScheduler

**[View PR on GitHub](https://github.com/cockroachdb/cockroach/pull/165577)**

| | |
|---|---|
| **Author** | @sumeerbhola |
| **Status** | ✅ merged |
| **Opened** | 2026-03-12 |
| **Repo** | curated review-culture seed |
| **Diff** | +1449 / −0 across 11 files |
| **Engagement** | 13 conversation · 115 inline review comments |

## Top review comments (ranked by reactions)

### @cockroach-teamcity — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/165577#issuecomment-4049796302)

> This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/cockroachdb/cockroach/165577)

### @cockroach-teamcity — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/165577#issuecomment-4071837172)

> <details><summary><strong>⚪ Sysbench</strong> [SQL, 3node, oltp_read_write]</summary>
> 
> | Metric                      | Old Commit     | New Commit     | Delta      | Note         |
> |-----------------------------|----------------|----------------|------------|--------------|
> | ⚪ **sec/op** | 10.33m ±2% | 10.35m ±3% | ~ | p=0.870 n=15    |
> | ⚪ **allocs/op** | 8.088k ±0% | 8.114k ±1% | ~ | p=0.076 n=15    |
> 
> <details><summary>Reproduce</summary>
> 
> **benchdiff binaries**:
> ```shell
> mkdir -p benchdiff/de960ea/bin/1058449141
> gcloud storage cp gs://cockroach-microbench-ci/builds/de960ea67a878df9504e5737ebca4652de6799b9/bin/pkg_sql_tests benchdiff/de960ea/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> chmod +x benchdiff/de960ea/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> mkdir -p benchdiff/45bf817/bin/1058449141
> gcloud storage cp gs://cockroach-microbench-ci/builds/45bf817f623bd1ec498f333b880b22d4b92f46ef/bin/pkg_sql_tests benchdiff/45bf817/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> chmod +x benchdiff/45bf817/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> ```
> **benchdiff command**:
> ```shell
> # NB: for best (most stable) results, also add a suitable `--benchtime` that
> # results in ~1s to ~5s of benchmark runs. For example, if ops average ~3ms, a
> # benchtime of `1000x` is appropriate.
> #
> # Some benchmarks (in particular BenchmarkSysbench) output additional memory
> # profiles covering only the execution (excluding the setup/teardown) - those
> # should be preferred for analysis since they more closely correspond to what's
> # reported as B/op and alloc/op.
> benchdiff --ru … *[truncated]*

### @cockroach-teamcity — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/165577#issuecomment-4209643817)

> <details><summary><strong>⚪ Sysbench</strong> [SQL, 3node, oltp_read_write]</summary>
> 
> | Metric                      | Old Commit     | New Commit     | Delta      | Note         |
> |-----------------------------|----------------|----------------|------------|--------------|
> | ⚪ **sec/op** | 11.18m ±1% | 11.14m ±1% | ~ | p=0.061 n=15    |
> | ⚪ **allocs/op** | 8.131k ±1% | 8.096k ±1% | ~ | p=0.040 n=15    |
> 
> <details><summary>Reproduce</summary>
> 
> **benchdiff binaries**:
> ```shell
> mkdir -p benchdiff/06acc1b/bin/1058449141
> gcloud storage cp gs://cockroach-microbench-ci/builds/06acc1b9824973df1c12d2aac5e4cbe50c6eabe0/bin/pkg_sql_tests benchdiff/06acc1b/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> chmod +x benchdiff/06acc1b/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> mkdir -p benchdiff/45bf817/bin/1058449141
> gcloud storage cp gs://cockroach-microbench-ci/builds/45bf817f623bd1ec498f333b880b22d4b92f46ef/bin/pkg_sql_tests benchdiff/45bf817/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> chmod +x benchdiff/45bf817/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> ```
> **benchdiff command**:
> ```shell
> # NB: for best (most stable) results, also add a suitable `--benchtime` that
> # results in ~1s to ~5s of benchmark runs. For example, if ops average ~3ms, a
> # benchtime of `1000x` is appropriate.
> #
> # Some benchmarks (in particular BenchmarkSysbench) output additional memory
> # profiles covering only the execution (excluding the setup/teardown) - those
> # should be preferred for analysis since they more closely correspond to what's
> # reported as B/op and alloc/op.
> benchdiff --ru … *[truncated]*

### @cockroach-teamcity — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/165577#issuecomment-4214638346)

> <details><summary><strong>⚪ Sysbench</strong> [SQL, 3node, oltp_read_write]</summary>
> 
> | Metric                      | Old Commit     | New Commit     | Delta      | Note         |
> |-----------------------------|----------------|----------------|------------|--------------|
> | ⚪ **sec/op** | 11.02m ±7% | 10.84m ±5% | ~ | p=0.367 n=15    |
> | ⚪ **allocs/op** | 8.352k ±3% | 8.134k ±3% | ~ | p=0.367 n=15    |
> 
> <details><summary>Reproduce</summary>
> 
> **benchdiff binaries**:
> ```shell
> mkdir -p benchdiff/9e242c9/bin/1058449141
> gcloud storage cp gs://cockroach-microbench-ci/builds/9e242c94ca0f2a55b0abccf2d4a827266473ad4a/bin/pkg_sql_tests benchdiff/9e242c9/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> chmod +x benchdiff/9e242c9/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> mkdir -p benchdiff/606bca1/bin/1058449141
> gcloud storage cp gs://cockroach-microbench-ci/builds/606bca10559ffa945b70560f49283d794d4b80f0/bin/pkg_sql_tests benchdiff/606bca1/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> chmod +x benchdiff/606bca1/bin/1058449141/cockroachdb_cockroach_pkg_sql_tests
> ```
> **benchdiff command**:
> ```shell
> # NB: for best (most stable) results, also add a suitable `--benchtime` that
> # results in ~1s to ~5s of benchmark runs. For example, if ops average ~3ms, a
> # benchtime of `1000x` is appropriate.
> #
> # Some benchmarks (in particular BenchmarkSysbench) output additional memory
> # profiles covering only the execution (excluding the setup/teardown) - those
> # should be preferred for analysis since they more closely correspond to what's
> # reported as B/op and alloc/op.
> benchdiff --ru … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
