# 📚 Master Index — Valuable PR Review Comments Corpus

> **1424 PR files** across 1313 unique pull requests, every one a merged, 2024-onward PR chosen for the *value of its review prose*. Collected four ways (all no-token):

| Source | How | Count | Index |
|---|---|--:|---|
| **Curated (API)** | hand-analyzed, exact reactions, with a lesson | 16 | [README.md](README.md) |
| **Curated (web)** | hand-analyzed via WebFetch, with a lesson | 20 | [WEB-RESEARCH.md](WEB-RESEARCH.md) |
| **Workflow (web, parallel)** | 16 agents WebFetched github.com pages | 1093 | this file |
| **Auto (Bun collector)** | `collect.ts`, rate-limit-aware API | 295 | [COLLECTED.md](COLLECTED.md) |

The **[SYNTHESIS.md](SYNTHESIS.md)** distills the cross-cutting patterns of what makes a review comment valuable. The collector that keeps this growing is **[collect.ts](collect.ts)** (`make collect-pr-reviews`).

> ℹ️ 111 PRs appear under more than one source (e.g. both curated and auto-collected) — kept intentionally so each collection method is self-contained.

## Workflow batch (95 — parallel WebFetch)

| Repo | PR | Title |
|------|----|-------|
| 11ty/eleventy | [#3573](prs/auto-web-11ty-eleventy-3573.md) | Adds `html-relative` Passthrough Copy mode for relative asse |
| 11ty/eleventy | [#3680](prs/auto-web-11ty-eleventy-3680.md) | Replace glob packages with lighter alternatives (`fast-glob` |
| 11ty/eleventy | [#3715](prs/auto-web-11ty-eleventy-3715.md) | Dependency optimization |
| 11ty/eleventy | [#4247](prs/auto-web-11ty-eleventy-4247.md) | Fix TypeScript data files not being processed |
| actix/actix-web | [#3291](prs/auto-web-actix-actix-web-3291.md) | Add `unicode` feature to switch between `regex` and `regex-l |
| actix/actix-web | [#3526](prs/auto-web-actix-actix-web-3526.md) | Fix continuous integration |
| actix/actix-web | [#3560](prs/auto-web-actix-actix-web-3560.md) | implement Responder for Result<(), E: Error> |
| actix/actix-web | [#3653](prs/auto-web-actix-actix-web-3653.md) | Resolved collisions between `missing_docs` clippy lints |
| aio-libs/aiohttp | [#10762](prs/auto-web-aio-libs-aiohttp-10762.md) | Remove pytest_plugin |
| aio-libs/aiohttp | [#8063](prs/auto-web-aio-libs-aiohttp-8063.md) | Add server capability to check for Brotli compressed static  |
| aio-libs/aiohttp | [#8089](prs/auto-web-aio-libs-aiohttp-8089.md) | 💅 Propagate error causes via asyncio protocols |
| aio-libs/aiohttp | [#9732](prs/auto-web-aio-libs-aiohttp-9732.md) | Add Client Middleware Support |
| alacritty/alacritty | [#7935](prs/auto-web-alacritty-alacritty-7935.md) | Bump winit to 0.30.0 |
| alacritty/alacritty | [#8269](prs/auto-web-alacritty-alacritty-8269.md) | Add window.level to set window level (Normal, AlwaysOnTop). |
| alacritty/alacritty | [#8434](prs/auto-web-alacritty-alacritty-8434.md) | Add an option to drain child process output before terminati |
| alacritty/alacritty | [#8627](prs/auto-web-alacritty-alacritty-8627.md) | windows: Properly escape command line arguments |
| alpinejs/alpine | [#4000](prs/auto-web-alpinejs-alpine-4000.md) | feat: Update lifecycle and mutation |
| alpinejs/alpine | [#4175](prs/auto-web-alpinejs-alpine-4175.md) | 🐛 Masks model updates |
| alpinejs/alpine | [#4186](prs/auto-web-alpinejs-alpine-4186.md) | Allow debouncing/throttling x-model when using x-modelable |
| alpinejs/alpine | [#4361](prs/auto-web-alpinejs-alpine-4361.md) | ⚡ Improves x-for performance |
| apache/airflow | [#56187](prs/auto-web-apache-airflow-56187.md) | Move the traces and metrics code under a common observabilit |
| apache/cassandra | [#3416](prs/auto-web-apache-cassandra-3416.md) | CEP-15: (Accord) sequence EpochReady.coordinating to allow s |
| apache/cassandra | [#3696](prs/auto-web-apache-cassandra-3696.md) | Add JDK21 support |
| apache/cassandra | [#4118](prs/auto-web-apache-cassandra-4118.md) | CASSANDRA-20336 (Add mutation tracking summary to SSTables) |
| apache/cassandra | [#4402](prs/auto-web-apache-cassandra-4402.md) | Add cursor-based low allocation optimized compaction impleme |
| apache/datafusion | [#16196](prs/auto-web-apache-datafusion-16196.md) | feat: Allow cancelling of grouping operations which are CPU  |
| apache/datafusion | [#20047](prs/auto-web-apache-datafusion-20047.md) | Add a memory bound FileStatisticsCache for the Listing Table |
| apache/datafusion | [#21679](prs/auto-web-apache-datafusion-21679.md) | Add lambda support and array_transform udf |
| apache/druid | [#15817](prs/auto-web-apache-druid-15817.md) | Introduce Segment Schema Publishing and Polling for Efficien |
| apache/druid | [#16291](prs/auto-web-apache-druid-16291.md) | Auto-Compaction using Multi-Stage Query Engine |
| apache/druid | [#16667](prs/auto-web-apache-druid-16667.md) | Do not kill segments with referenced load specs from deep st |
| apache/druid | [#18844](prs/auto-web-apache-druid-18844.md) | Implement a fingerprinting mechanism to track compaction sta |
| apache/iceberg | [#10179](prs/auto-web-apache-iceberg-10179.md) | Introduces the new IcebergSink based on the new V2 Flink Sin |
| apache/iceberg | [#12774](prs/auto-web-apache-iceberg-12774.md) | Core, Data: File Format API interfaces |
| apache/iceberg | [#14117](prs/auto-web-apache-iceberg-14117.md) | SPEC: Add SQL UDF spec |
| apache/iceberg | [#9695](prs/auto-web-apache-iceberg-9695.md) | Add Scan Planning Endpoints to open api spec |
| apache/superset | [#36368](prs/auto-web-apache-superset-36368.md) | feat: add global task framework |
| apache/superset | [#37625](prs/auto-web-apache-superset-37625.md) | chore(frontend): comprehensive TypeScript quality improvemen |
| apache/superset | [#37973](prs/auto-web-apache-superset-37973.md) | feat(api-keys): add API key authentication via FAB SecurityM |
| apache/superset | [#39604](prs/auto-web-apache-superset-39604.md) | fix(mcp): API key authentication for MCP — transport, valida |
| apache/tvm | [#16425](prs/auto-web-apache-tvm-16425.md) | [Target] Use LLVM target parser for determining Arm(R) A-Pro |
| apache/tvm | [#16569](prs/auto-web-apache-tvm-16569.md) | [Unity][Parser] Check well-formedness in the parser |
| apache/tvm | [#16966](prs/auto-web-apache-tvm-16966.md) | [SVE] Add support for representing and creating buffer-level |
| apache/tvm | [#18871](prs/auto-web-apache-tvm-18871.md) | Batched GPU dispatch and object caching for WebGPU runtime |
| apple/foundationdb | [#11369](prs/auto-web-apple-foundationdb-11369.md) | Bulk Loading Framework |
| apple/foundationdb | [#11693](prs/auto-web-apple-foundationdb-11693.md) | Database Per-Range Lock |
| apple/foundationdb | [#11780](prs/auto-web-apple-foundationdb-11780.md) | BulkDump Framework |
| apple/foundationdb | [#11898](prs/auto-web-apple-foundationdb-11898.md) | Bulkload Engine Support General Storage Engine and Fix BulkL |
| appwrite/appwrite | [#10468](prs/auto-web-appwrite-appwrite-10468.md) | Feat apps module dl |
| appwrite/appwrite | [#11886](prs/auto-web-appwrite-appwrite-11886.md) | Presence api |
| appwrite/appwrite | [#8378](prs/auto-web-appwrite-appwrite-8378.md) | Development Keys |
| appwrite/appwrite | [#8384](prs/auto-web-appwrite-appwrite-8384.md) | Add runtime controls |
| aquasecurity/trivy | [#6234](prs/auto-web-aquasecurity-trivy-6234.md) | docs: Add documentation for contributing additional checks t |
| aquasecurity/trivy | [#6781](prs/auto-web-aquasecurity-trivy-6781.md) | ci: automate backporting process |
| aquasecurity/trivy | [#7732](prs/auto-web-aquasecurity-trivy-7732.md) | docs: improve databases documentation |
| aquasecurity/trivy | [#8080](prs/auto-web-aquasecurity-trivy-8080.md) | feat(python): add support for uv |
| argoproj/argo-cd | [#17403](prs/auto-web-argoproj-argo-cd-17403.md) | feat: Decoupling application sync using impersonation |
| argoproj/argo-cd | [#18646](prs/auto-web-argoproj-argo-cd-18646.md) | feat: oci support (Beta) |
| argoproj/argo-cd | [#20074](prs/auto-web-argoproj-argo-cd-20074.md) | feat(cli): Add Plugin Support to the Argo CD CLI |
| argoproj/argo-cd | [#25371](prs/auto-web-argoproj-argo-cd-25371.md) | feat(source-integrity): Implement Source Integrity checking |
| argoproj/argo-workflows | [#12467](prs/auto-web-argoproj-argo-workflows-12467.md) | feat(artifacts): support ephemeral credentials for S3. Fixes |
| argoproj/argo-workflows | [#12537](prs/auto-web-argoproj-argo-workflows-12537.md) | fix: make sure taskresult completed when mark node succeed w |
| argoproj/argo-workflows | [#13393](prs/auto-web-argoproj-argo-workflows-13393.md) | docs: synchronization and paralellism docs improvements |
| argoproj/argo-workflows | [#13474](prs/auto-web-argoproj-argo-workflows-13474.md) | feat(cron): cronworkflows `when` clause |
| astral-sh/ruff | [#13636](prs/auto-web-astral-sh-ruff-13636.md) | [red-knot] type inference/checking test framework |
| astral-sh/ruff | [#17851](prs/auto-web-astral-sh-ruff-17851.md) | Implement template strings |
| astral-sh/ruff | [#21385](prs/auto-web-astral-sh-ruff-21385.md) | Keep lambda parameters on one line and parenthesize the body |
| astral-sh/ruff | [#22291](prs/auto-web-astral-sh-ruff-22291.md) | [ty] Add support for dynamic `type()` classes |
| BabylonJS/Babylon.js | [#16253](prs/auto-web-babylonjs-babylon.js-16253.md) | Diffuse Roughness support |
| BabylonJS/Babylon.js | [#16773](prs/auto-web-babylonjs-babylon.js-16773.md) | OpenPBRMaterial (including loading and exporting glTF) |
| BabylonJS/Babylon.js | [#17035](prs/auto-web-babylonjs-babylon.js-17035.md) | NavigationPluginV2 addon |
| BabylonJS/Babylon.js | [#17583](prs/auto-web-babylonjs-babylon.js-17583.md) | Introduce selection outline layer |
| BerriAI/litellm | [#22923](prs/auto-web-berriai-litellm-22923.md) | fix(sso): direct PKCE token exchange + Redis wiring for mult |
| BerriAI/litellm | [#26569](prs/auto-web-berriai-litellm-26569.md) | Litellm oss staging 04 21 2026 2 |
| BerriAI/litellm | [#26590](prs/auto-web-berriai-litellm-26590.md) | [Feat] Add tool calling support for gemini and vertex ai liv |
| BerriAI/litellm | [#28868](prs/auto-web-berriai-litellm-28868.md) | feat(context_management): compact_20260112 polyfill for non- |
| bigskysoftware/htmx | [#2280](prs/auto-web-bigskysoftware-htmx-2280.md) | Add htmx security essay |
| bigskysoftware/htmx | [#2902](prs/auto-web-bigskysoftware-htmx-2902.md) | Support multiple extended selectors for hx-include, hx-trigg |
| bigskysoftware/htmx | [#3131](prs/auto-web-bigskysoftware-htmx-3131.md) | Attach hx-on handlers before processing nodes |
| bigskysoftware/htmx | [#3173](prs/auto-web-bigskysoftware-htmx-3173.md) | Write title as innerText instead of innerHTML |
| bitcoin/bitcoin | [#29415](prs/auto-web-bitcoin-bitcoin-29415.md) | Broadcast own transactions only via short-lived Tor or I2P c |
| bitcoin/bitcoin | [#29775](prs/auto-web-bitcoin-bitcoin-29775.md) | Testnet4 including PoW difficulty adjustment fix |
| bitcoin/bitcoin | [#33453](prs/auto-web-bitcoin-bitcoin-33453.md) | docs: Undeprecate datacarrier and datacarriersize configurat |
| bitcoin/bitcoin | [#33723](prs/auto-web-bitcoin-bitcoin-33723.md) | chainparams: remove dnsseed.bitcoin.dashjr-list-of-p2p-nodes |
| BuilderIO/qwik | [#5846](prs/auto-web-builderio-qwik-5846.md) | feat(qwik-core): Uint8Array serializer |
| BuilderIO/qwik | [#6752](prs/auto-web-builderio-qwik-6752.md) | feat: add `valibot$` validator and fix types of `zod$` imple |
| BuilderIO/qwik | [#7517](prs/auto-web-builderio-qwik-7517.md) | feat(cli): Add check-client command to verify bundle freshne |
| BuilderIO/qwik | [#7562](prs/auto-web-builderio-qwik-7562.md) | Support rewrite request (Similarly to redirect) |
| BurntSushi/ripgrep | [#2787](prs/auto-web-burntsushi-ripgrep-2787.md) | Set up ripgrep for compilation on non-unix, non-windows plat |
| BurntSushi/ripgrep | [#2957](prs/auto-web-burntsushi-ripgrep-2957.md) | feat(completion): support sourcing zsh completion dynamicall |
| BurntSushi/ripgrep | [#3165](prs/auto-web-burntsushi-ripgrep-3165.md) | Add RISC-V (riscv64gc-unknown-linux-gnu) CI and release arti |
| BurntSushi/ripgrep | [#3420](prs/auto-web-burntsushi-ripgrep-3420.md) | ignore: scope compiled parent matchers by root |
| bytecodealliance/wasmtime | [#10106](prs/auto-web-bytecodealliance-wasmtime-10106.md) | add component-model-async/{fused|futures|streams}.wast tests |
| bytecodealliance/wasmtime | [#10388](prs/auto-web-bytecodealliance-wasmtime-10388.md) | Stack switching: Infrastructure and runtime support |
| bytecodealliance/wasmtime | [#11326](prs/auto-web-bytecodealliance-wasmtime-11326.md) | WebAssembly exception-handling support. |
| bytecodealliance/wasmtime | [#11769](prs/auto-web-bytecodealliance-wasmtime-11769.md) | Wasmtime: implement debug instrumentation and basic host API |
| caddyserver/caddy | [#6050](prs/auto-web-caddyserver-caddy-6050.md) | caddytls: clientauth: leaf verifier: make trusted leaf certs |
| caddyserver/caddy | [#6146](prs/auto-web-caddyserver-caddy-6146.md) | autohttps: Implement `auto_https prefer_wildcard` option |
| caddyserver/caddy | [#6229](prs/auto-web-caddyserver-caddy-6229.md) | Upgrade: ACMEz v2, CertMagic, and ZeroSSL issuer |
| caddyserver/caddy | [#6399](prs/auto-web-caddyserver-caddy-6399.md) | core: add modular `network_proxy` support |
| celery/celery | [#9207](prs/auto-web-celery-celery-9207.md) | Native Delayed Delivery in RabbitMQ |
| celery/celery | [#9371](prs/auto-web-celery-celery-9371.md) | fix: prevent celery from hanging due to spawned greenlet err |
| celery/celery | [#9799](prs/auto-web-celery-celery-9799.md) | Fix memory leak in exception handling (Issue #8882) |
| celery/celery | [#9986](prs/auto-web-celery-celery-9986.md) | Fix: Broker heartbeats not sent during graceful shutdown |
| charmbracelet/bubbletea | [#1111](prs/auto-web-charmbracelet-bubbletea-1111.md) | (v2) Use KeyMsg/MouseMsg interfaces |
| charmbracelet/bubbletea | [#1132](prs/auto-web-charmbracelet-bubbletea-1132.md) | feat(render): improve renderer; remove flickering |
| charmbracelet/bubbletea | [#1276](prs/auto-web-charmbracelet-bubbletea-1276.md) | Maintain exec output |
| charmbracelet/bubbletea | [#1542](prs/auto-web-charmbracelet-bubbletea-1542.md) | v2: Support mode 2026 (synchronized output updates) |
| charmbracelet/lipgloss | [#264](prs/auto-web-charmbracelet-lipgloss-264.md) | feat: trees and lists |
| charmbracelet/lipgloss | [#446](prs/auto-web-charmbracelet-lipgloss-446.md) | feat(tree): support width and indenter styling |
| charmbracelet/lipgloss | [#479](prs/auto-web-charmbracelet-lipgloss-479.md) | feat(table): improve sizing and behavior: wrap by default, o |
| charmbracelet/lipgloss | [#550](prs/auto-web-charmbracelet-lipgloss-550.md) | feat: color blending & other low-level color utilities |
| chroma-core/chroma | [#2803](prs/auto-web-chroma-core-chroma-2803.md) | [PERF] Convert embeddings representation to numpy |
| chroma-core/chroma | [#5867](prs/auto-web-chroma-core-chroma-5867.md) | [ENH]: Execute task with no backfill or incremental |
| chroma-core/chroma | [#6806](prs/auto-web-chroma-core-chroma-6806.md) | [ENH] Add put_stream to chroma-storage for streaming S3 uplo |
| chroma-core/chroma | [#6842](prs/auto-web-chroma-core-chroma-6842.md) | [ENH]: Integrate seal operator for sharded collections |
| cilium/cilium | [#34205](prs/auto-web-cilium-cilium-34205.md) | Transactional selector cache |
| cilium/cilium | [#34484](prs/auto-web-cilium-cilium-34484.md) | Add an experimental xDS client |
| cilium/cilium | [#38388](prs/auto-web-cilium-cilium-38388.md) | CES: add option to create CES directly from pods |
| cilium/cilium | [#38669](prs/auto-web-cilium-cilium-38669.md) | feat(sdp): Adding the cilium grpc server |
| clap-rs/clap | [#5539](prs/auto-web-clap-rs-clap-5539.md) | feat(clap_complete): Support flags with values `--flag bar`  |
| clap-rs/clap | [#5621](prs/auto-web-clap-rs-clap-5621.md) | Support dynamic value of argument completion |
| clap-rs/clap | [#5891](prs/auto-web-clap-rs-clap-5891.md) | Markdown parsing in doc comments |
| clap-rs/clap | [#6057](prs/auto-web-clap-rs-clap-6057.md) | feat(help): Allow styling for inline context |
| cli/cli | [#10513](prs/auto-web-cli-cli-10513.md) | `gh pr create`: Support Git's `@{push}` revision syntax for  |
| cli/cli | [#10710](prs/auto-web-cli-cli-10710.md) | Introduce accessible prompter for screen readers (preview) |
| cli/cli | [#13057](prs/auto-web-cli-cli-13057.md) | Add Issues 2.0 support: issue types, sub-issues, and relatio |
| cli/cli | [#8698](prs/auto-web-cli-cli-8698.md) | gh-attestation cmd integration |
| cloudflare/workerd | [#4591](prs/auto-web-cloudflare-workerd-4591.md) | implement node:http server-side modules |
| cloudflare/workerd | [#5014](prs/auto-web-cloudflare-workerd-5014.md) | Streams cleanups... new adapters |
| cloudflare/workerd | [#5396](prs/auto-web-cloudflare-workerd-5396.md) | Reworking Headers impl |
| cloudflare/workerd | [#5448](prs/auto-web-cloudflare-workerd-5448.md) | improve text encoder encode performance |
| cockroachdb/cockroach | [#131850](prs/auto-web-cockroachdb-cockroach-131850.md) | raft: add tracing to raft |
| cockroachdb/cockroach | [#138872](prs/auto-web-cockroachdb-cockroach-138872.md) | ccl/changefeedccl: add compression options for webhook sink |
| comfyanonymous/ComfyUI | [#13408](prs/auto-web-comfyanonymous-comfyui-13408.md) | feat: SAM (segment anything) 3.1 support (CORE-34) |
| comfyanonymous/ComfyUI | [#2666](prs/auto-web-comfyanonymous-comfyui-2666.md) | Execution Model Inversion |
| comfyanonymous/ComfyUI | [#7063](prs/auto-web-comfyanonymous-comfyui-7063.md) | MultiGPU Work Units For Accelerated Sampling (CORE-184) |
| comfyanonymous/ComfyUI | [#7223](prs/auto-web-comfyanonymous-comfyui-7223.md) | Add --use-flash-attention flag |
| containerd/containerd | [#10177](prs/auto-web-containerd-containerd-10177.md) | Multipart layer fetch |
| containerd/containerd | [#10579](prs/auto-web-containerd-containerd-10579.md) | Add OCI/Image Volume Source support |
| containerd/containerd | [#12317](prs/auto-web-containerd-containerd-12317.md) | pkg/sys: Create user namespace as the container's initial us |
| containerd/containerd | [#12555](prs/auto-web-containerd-containerd-12555.md) | ctr: add EROFS image conversion support |
| cosmos/cosmos-sdk | [#19048](prs/auto-web-cosmos-cosmos-sdk-19048.md) | feat(x/accounts): Add new lockup account type |
| cosmos/cosmos-sdk | [#19697](prs/auto-web-cosmos-cosmos-sdk-19697.md) | feat(x/epochs): upstream osmosis epoch module |
| cosmos/cosmos-sdk | [#20453](prs/auto-web-cosmos-cosmos-sdk-20453.md) | feat(store/v2): implement the feature to upgrade the store k |
| cosmos/cosmos-sdk | [#22267](prs/auto-web-cosmos-cosmos-sdk-22267.md) | refactor(server/v2): eager config loading |
| crossplane/crossplane | [#6255](prs/auto-web-crossplane-crossplane-6255.md) | Proposal: Crossplane v2 |
| crossplane/crossplane | [#6557](prs/auto-web-crossplane-crossplane-6557.md) | Design document: Day Two Operations |
| crossplane/crossplane | [#6777](prs/auto-web-crossplane-crossplane-6777.md) | Add circuit breaker to prevent XR reconciliation thrashing |
| crossplane/crossplane | [#6909](prs/auto-web-crossplane-crossplane-6909.md) | design: Add a design document for developer experience tooli |
| crystal-lang/crystal | [#14167](prs/auto-web-crystal-lang-crystal-14167.md) | Add `WaitGroup` synchronization primitive |
| crystal-lang/crystal | [#14996](prs/auto-web-crystal-lang-crystal-14996.md) | Refactor Lifetime Event Loop |
| crystal-lang/crystal | [#15263](prs/auto-web-crystal-lang-crystal-15263.md) | Add support for IPv6 scoped addresses (RFC4007) |
| crystal-lang/crystal | [#16264](prs/auto-web-crystal-lang-crystal-16264.md) | Add io_uring event loop (linux) |
| cupy/cupy | [#8442](prs/auto-web-cupy-cupy-8442.md) | Support system allocated memory |
| cupy/cupy | [#8683](prs/auto-web-cupy-cupy-8683.md) | ENH: Implement dlpack v1 |
| cupy/cupy | [#9654](prs/auto-web-cupy-cupy-9654.md) | Cython Compilation Warnings of implicit noexcept |
| cupy/cupy | [#9825](prs/auto-web-cupy-cupy-9825.md) | Add int64 index support to `cupyx.scipy.sparse` |
| cypress-io/cypress | [#30770](prs/auto-web-cypress-io-cypress-30770.md) | breaking: no longer inject document.domain by default |
| cypress-io/cypress | [#31496](prs/auto-web-cypress-io-cypress-31496.md) | feat: extend Cypress.Keyboard.Keys and cy.press to support ( |
| cypress-io/cypress | [#32699](prs/auto-web-cypress-io-cypress-32699.md) | fix: normalize test body `invocationDetails` from stack trac |
| cypress-io/cypress | [#33542](prs/auto-web-cypress-io-cypress-33542.md) | fix: graceful teardown of file watchers and spawned processe |
| dagster-io/dagster | [#23978](prs/auto-web-dagster-io-dagster-23978.md) | deploying to kubernetes guide |
| dagster-io/dagster | [#25320](prs/auto-web-dagster-io-dagster-25320.md) | Doc 302 new etl tutorial - part 1 |
| dagster-io/dagster | [#29566](prs/auto-web-dagster-io-dagster-29566.md) | Make docs more LLM friendly |
| dagster-io/dagster | [#31796](prs/auto-web-dagster-io-dagster-31796.md) | [docs] Revise tutorial |
| dart-lang/sdk | [#26012](prs/auto-web-dart-lang-sdk-26012.md) | reflectType() dynamic type arguments support |
| dart-lang/sdk | [#27093](prs/auto-web-dart-lang-sdk-27093.md) | Updated directory_linux.cc to conform with the deprecation o |
| dart-lang/sdk | [#28176](prs/auto-web-dart-lang-sdk-28176.md) | Informal proposal for covariant overrides. |
| dart-lang/sdk | [#34921](prs/auto-web-dart-lang-sdk-34921.md) | Create experimental flags documentation |
| dask/dask | [#11248](prs/auto-web-dask-dask-11248.md) | Add a Task class to replace tuples for task specification |
| dask/dask | [#11262](prs/auto-web-dask-dask-11262.md) | Implement task-based array shuffle |
| dask/dask | [#11568](prs/auto-web-dask-dask-11568.md) | Blockwise uses `Task` class |
| dask/dask | [#12153](prs/auto-web-dask-dask-12153.md) | Support zarr sharding through create_array |
| dbt-labs/dbt-core | [#11987](prs/auto-web-dbt-labs-dbt-core-11987.md) | update to latest jsonschemas |
| dbt-labs/dbt-core | [#12930](prs/auto-web-dbt-labs-dbt-core-12930.md) | feat: catalogs.yml v2 with adapter-owned bridge architecture |
| dbt-labs/dbt-core | [#13020](prs/auto-web-dbt-labs-dbt-core-13020.md) | Implement dbt Login Command |
| dbt-labs/dbt-core | [#13029](prs/auto-web-dbt-labs-dbt-core-13029.md) | Add --use-v2-parser to delegate parsing to the fusion parser |
| deepset-ai/haystack | [#8554](prs/auto-web-deepset-ai-haystack-8554.md) | feat: adding Maximum Margin Relevance Ranker |
| deepset-ai/haystack | [#8605](prs/auto-web-deepset-ai-haystack-8605.md) | feat: add `RecursiveSplitter` component for `Document` prepr |
| deepset-ai/haystack | [#9660](prs/auto-web-deepset-ai-haystack-9660.md) | feat: MarkdownHeaderSplitter |
| deepset-ai/haystack | [#9754](prs/auto-web-deepset-ai-haystack-9754.md) | feat: support structured outputs in `OpenAIChatGenerator` |
| deepspeedai/DeepSpeed | [#7391](prs/auto-web-deepspeedai-deepspeed-7391.md) | Add Zenflow code for Stage 1 & 2 |
| deepspeedai/DeepSpeed | [#7448](prs/auto-web-deepspeedai-deepspeed-7448.md) | [AMD][ROCm] Improve support of AMD |
| deepspeedai/DeepSpeed | [#7860](prs/auto-web-deepspeedai-deepspeed-7860.md) | Merging AutoSP into DeepSpeed |
| deepspeedai/DeepSpeed | [#7887](prs/auto-web-deepspeedai-deepspeed-7887.md) | [SP] add SP deny list instead of allow |
| delta-io/delta | [#2826](prs/auto-web-delta-io-delta-2826.md) | [Kernel] Add kernel support for v2 checkpoints |
| delta-io/delta | [#3392](prs/auto-web-delta-io-delta-3392.md) | [Spark] Add Scala `clone`, `cloneAtVersion`, and `cloneAtTim |
| delta-io/delta | [#3835](prs/auto-web-delta-io-delta-3835.md) | [Kernel] Add Domain Metadata support to Delta Kernel |
| delta-io/delta | [#6166](prs/auto-web-delta-io-delta-6166.md) | [Delta-Spark] Extend stagingCatalog for non-Spark session ca |
| derailed/k9s | [#2461](prs/auto-web-derailed-k9s-2461.md) | Secrets are decoded upon describe |
| derailed/k9s | [#2799](prs/auto-web-derailed-k9s-2799.md) | feat(app): add history navigation with `[` and `]`, most rec |
| derailed/k9s | [#3503](prs/auto-web-derailed-k9s-3503.md) | fix(logs): enhance log streaming with retry mechanism and er |
| derailed/k9s | [#3736](prs/auto-web-derailed-k9s-3736.md) | feat: add custom resource jump support |
| dgraph-io/dgraph | [#9190](prs/auto-web-dgraph-io-dgraph-9190.md) | upgrade to use google protobuf |
| dgraph-io/dgraph | [#9381](prs/auto-web-dgraph-io-dgraph-9381.md) | feat: add import api support for multiple groups with a sing |
| dgraph-io/dgraph | [#9406](prs/auto-web-dgraph-io-dgraph-9406.md) | Add support for HA and multishard functionality in import AP |
| diesel-rs/diesel | [#3951](prs/auto-web-diesel-rs-diesel-3951.md) | Add Postgres COPY FROM/TO support |
| diesel-rs/diesel | [#4169](prs/auto-web-diesel-rs-diesel-4169.md) | Added custom array example with documentation. |
| diesel-rs/diesel | [#4284](prs/auto-web-diesel-rs-diesel-4284.md) | Add SQLite support for serde_json::Value using the Json/Json |
| diesel-rs/diesel | [#5049](prs/auto-web-diesel-rs-diesel-5049.md) | Add support for PostgreSQL's RETURNING old.column |
| DioxusLabs/dioxus | [#2258](prs/auto-web-dioxuslabs-dioxus-2258.md) | Hotreloading of `for/if/body`, formatted strings, literals,  |
| DioxusLabs/dioxus | [#3195](prs/auto-web-dioxuslabs-dioxus-3195.md) | Restore manganis optimizations |
| DioxusLabs/dioxus | [#3753](prs/auto-web-dioxuslabs-dioxus-3753.md) | feat: windows app icon |
| DioxusLabs/dioxus | [#4842](prs/auto-web-dioxuslabs-dioxus-4842.md) | permissions, `manganis::ffi`, full Info.plist/AndroidManifes |
| directus/directus | [#22125](prs/auto-web-directus-directus-22125.md) | Add public registration |
| directus/directus | [#25368](prs/auto-web-directus-directus-25368.md) | Add Services Type support for `@directus/extensions` |
| directus/directus | [#26172](prs/auto-web-directus-directus-26172.md) | Collaborative Editing Implementation (〃￣︶￣)人(￣︶￣〃) |
| directus/directus | [#26473](prs/auto-web-directus-directus-26473.md) | Add deployment module with Vercel provider support |
| django/django | [#18056](prs/auto-web-django-django-18056.md) | Fixed #373 -- Added CompositePrimaryKey. |
| django/django | [#18158](prs/auto-web-django-django-18158.md) | Fixed #35515 -- Added auto-importing to shell command. |
| django/django | [#19643](prs/auto-web-django-django-19643.md) | Fixed #36410 -- Added named template partials to DTL |
| dmlc/xgboost | [#10456](prs/auto-web-dmlc-xgboost-10456.md) | [R] Redesigned `xgboost()` interface skeleton |
| dmlc/xgboost | [#10639](prs/auto-web-dmlc-xgboost-10639.md) | [jvm-packages] [breaking] rework xgboost4j-spark and xgboost |
| dmlc/xgboost | [#11166](prs/auto-web-dmlc-xgboost-11166.md) | [doc] Reference the R doc in sphinx document site. |
| dmlc/xgboost | [#11808](prs/auto-web-dmlc-xgboost-11808.md) | Make block_size of BuildHistKernel adaptive |
| dotnet/runtime | [#102655](prs/auto-web-dotnet-runtime-102655.md) | NonBacktracking Regex optimizations |
| dotnet/runtime | [#123819](prs/auto-web-dotnet-runtime-123819.md) | New function pointer APIs |
| drizzle-team/drizzle-orm | [#1785](prs/auto-web-drizzle-team-drizzle-orm-1785.md) | Fix: json and jsonb parsing in postgres-js |
| drizzle-team/drizzle-orm | [#3974](prs/auto-web-drizzle-team-drizzle-orm-3974.md) | RQB v2 |
| drizzle-team/drizzle-orm | [#4314](prs/auto-web-drizzle-team-drizzle-orm-4314.md) | Add Arktype validation (via `drizzle-arktype` package) |
| drizzle-team/drizzle-orm | [#4439](prs/auto-web-drizzle-team-drizzle-orm-4439.md) | Alternation engine |
| duckdb/duckdb | [#11905](prs/auto-web-duckdb-duckdb-11905.md) | [Appender] Add `AppendDefault` |
| duckdb/duckdb | [#13345](prs/auto-web-duckdb-duckdb-13345.md) | add some RealNest benchmarks |
| duckdb/duckdb | [#16833](prs/auto-web-duckdb-duckdb-16833.md) | Unittester failures summary |
| duckdb/duckdb | [#17992](prs/auto-web-duckdb-duckdb-17992.md) | Add Option to Allocate Using an Arena in `string_t` |
| electron/electron | [#42953](prs/auto-web-electron-electron-42953.md) | feat: GPU shared texture offscreen rendering |
| electron/electron | [#44411](prs/auto-web-electron-electron-44411.md) | feat: service worker preload scripts for improved extensions |
| electron/electron | [#48149](prs/auto-web-electron-electron-48149.md) | feat: add `copyVideoFrameAt` and `saveVideoFrameAs` methods  |
| electron/electron | [#50043](prs/auto-web-electron-electron-50043.md) | feat: capture JS stack trace on renderer OOM |
| emilk/egui | [#3906](prs/auto-web-emilk-egui-3906.md) | Add layer transforms, interaction in layer |
| emilk/egui | [#4211](prs/auto-web-emilk-egui-4211.md) | Fix `ViewportCommand::InnerSize` not resizing viewport on Wa |
| emilk/egui | [#4620](prs/auto-web-emilk-egui-4620.md) | GIF support |
| emilk/egui | [#5830](prs/auto-web-emilk-egui-5830.md) | Add `AtomLayout`, abstracing layouting within widgets |
| encode/httpx | [#3050](prs/auto-web-encode-httpx-3050.md) | Deprecate `app=...` in favor of explicit `WSGITransport`/`AS |
| encode/httpx | [#3139](prs/auto-web-encode-httpx-3139.md) | Add support for zstd decoding |
| encode/httpx | [#3335](prs/auto-web-encode-httpx-3335.md) | Drop overloaded usage of 'verify' and 'cert' |
| encode/httpx | [#3367](prs/auto-web-encode-httpx-3367.md) | Ensure JSON representation is compact. #3363 |
| encode/starlette | [#2480](prs/auto-web-encode-starlette-2480.md) | Add type hints to `test_formparsers.py` |
| encode/starlette | [#2697](prs/auto-web-encode-starlette-2697.md) | Add support for HTTP Range to `FileResponse` |
| encode/starlette | [#2813](prs/auto-web-encode-starlette-2813.md) | Fix unclosed 'MemoryObjectReceiveStream' upon exception in ' |
| encode/starlette | [#2814](prs/auto-web-encode-starlette-2814.md) | collect errors more reliably from websocket test client |
| encode/uvicorn | [#2360](prs/auto-web-encode-uvicorn-2360.md) | fix: upgrade is not websocket and dependencies are installed |
| encode/uvicorn | [#2435](prs/auto-web-encode-uvicorn-2435.md) | Support custom IOLOOPs |
| encode/uvicorn | [#2540](prs/auto-web-encode-uvicorn-2540.md) | Add `WebSocketsSansIOProtocol` |
| encode/uvicorn | [#2742](prs/auto-web-encode-uvicorn-2742.md) | explicitly start ASGI run with empty context |
| ent/ent | [#4293](prs/auto-web-ent-ent-4293.md) | entc: global id feature |
| ent/ent | [#4296](prs/auto-web-ent-ent-4296.md) | dialect/sql/schema: add schema dump command |
| ent/ent | [#4355](prs/auto-web-ent-ent-4355.md) | entc/gen: change receivers to static one |
| ent/ent | [#4398](prs/auto-web-ent-ent-4398.md) | schema/field: validate rune length with `MinRuneLen` / `MaxR |
| envoyproxy/envoy | [#32465](prs/auto-web-envoyproxy-envoy-32465.md) | new extension for TLS cert selection |
| envoyproxy/envoy | [#35545](prs/auto-web-envoyproxy-envoy-35545.md) | access log: new 20x faster json formatter implementation |
| eslint/eslint | [#18134](prs/auto-web-eslint-eslint-18134.md) | feat: Add support for TS config files |
| eslint/eslint | [#18784](prs/auto-web-eslint-eslint-18784.md) | docs: add tabs to cli code blocks |
| espressif/esp-idf | [#15081](prs/auto-web-espressif-esp-idf-15081.md) | fix(storage/fatfs): Compiler unused warnings (IDFGH-14289) |
| espressif/esp-idf | [#15388](prs/auto-web-espressif-esp-idf-15388.md) | fix(esp_http_client): Fix host header for IPv6 address liter |
| espressif/esp-idf | [#15974](prs/auto-web-espressif-esp-idf-15974.md) | fix(tools/idf-qemu): Append qemu_extra_args after monitor -s |
| espressif/esp-idf | [#17799](prs/auto-web-espressif-esp-idf-17799.md) | feat(esp_http_server): Make HTTP(S)_SERVER_EVENT events opti |
| ethereum/go-ethereum | [#29338](prs/auto-web-ethereum-go-ethereum-29338.md) | cmd, core, params, trie: add verkle access witness gas charg |
| ethereum/go-ethereum | [#30078](prs/auto-web-ethereum-go-ethereum-30078.md) | all: implement eip-7702 set code tx |
| ethereum/go-ethereum | [#30643](prs/auto-web-ethereum-go-ethereum-30643.md) | triedb/pathdb: track flat state changes in pathdb (snapshot  |
| ethereum/go-ethereum | [#32157](prs/auto-web-ethereum-go-ethereum-32157.md) | internal/era: New EraE implementation |
| evanw/esbuild | [#3679](prs/auto-web-evanw-esbuild-3679.md) | fix #2388: allow consuming types without dom types |
| evanw/esbuild | [#4082](prs/auto-web-evanw-esbuild-4082.md) | Fix emitting real mapping sources when null mapping comes fi |
| evanw/esbuild | [#4142](prs/auto-web-evanw-esbuild-4142.md) | fix #4141: Avoid redundant `this` access during async functi |
| evanw/esbuild | [#4417](prs/auto-web-evanw-esbuild-4417.md) | fix: Handle non-awaited async generator |
| explosion/spaCy | [#13249](prs/auto-web-explosion-spacy-13249.md) | `TextCatParametricAttention.v1`: set key transform dimension |
| explosion/spaCy | [#13400](prs/auto-web-explosion-spacy-13400.md) | Fix use_gold_ents behaviour for EntityLinker |
| explosion/spaCy | [#13431](prs/auto-web-explosion-spacy-13431.md) | Add distill subcommand |
| explosion/spaCy | [#13807](prs/auto-web-explosion-spacy-13807.md) | Added Haitian Creole (ht) Language Support to spaCy |
| expo/expo | [#35463](prs/auto-web-expo-expo-35463.md) | Expo Router "Getting Started" guide |
| expo/expo | [#38366](prs/auto-web-expo-expo-38366.md) | [expo-blob] Added ExpoBlob package |
| expo/expo | [#39108](prs/auto-web-expo-expo-39108.md) | [expo-calendar][next] Implement `ExpoCalendar@next` |
| expo/expo | [#44442](prs/auto-web-expo-expo-44442.md) | Native modules types, generating typescript types |
| facebook/docusaurus | [#10137](prs/auto-web-facebook-docusaurus-10137.md) | feat(docs, blog): add support for `tags.yml`, predefined lis |
| facebook/docusaurus | [#11327](prs/auto-web-facebook-docusaurus-11327.md) | feat(search): add runtime support for DocSearch v4 |
| facebook/docusaurus | [#9912](prs/auto-web-facebook-docusaurus-9912.md) | feat(blog): add LastUpdateAuthor & LastUpdateTime |
| facebook/react | [#14853](prs/auto-web-facebook-react-14853.md) | await act(async () => ...) |
| facebook/react-native | [#42943](prs/auto-web-facebook-react-native-42943.md) | fix: fix codegen not finding all third-party libraries |
| facebook/react-native | [#45144](prs/auto-web-facebook-react-native-45144.md) | [LOCAL][Release-Testing] Update the testing script to use th |
| facebook/react-native | [#49135](prs/auto-web-facebook-react-native-49135.md) | [0.76] Bump Kotlin to 1.9.25 to mitigate #49115 |
| facebook/react-native | [#53980](prs/auto-web-facebook-react-native-53980.md) | Allow extending ReactTextViewManager again |
| Farama-Foundation/Gymnasium | [#1315](prs/auto-web-farama-foundation-gymnasium-1315.md) | Add stochastic taxi (rainy+fickle) |
| Farama-Foundation/Gymnasium | [#1333](prs/auto-web-farama-foundation-gymnasium-1333.md) | Add generic conversion wrapper between Array API compatible  |
| Farama-Foundation/Gymnasium | [#889](prs/auto-web-farama-foundation-gymnasium-889.md) | Made readout of seed possible in env |
| Farama-Foundation/Gymnasium | [#934](prs/auto-web-farama-foundation-gymnasium-934.md) | [Bug fix] remove `mujoco-py` import error for v4+ MuJoCo env |
| fastify/fastify | [#5252](prs/auto-web-fastify-fastify-5252.md) | feat: emit diagnostics_channel events upon routing request |
| fastify/fastify | [#5674](prs/auto-web-fastify-fastify-5674.md) | docs: add v5 guide |
| fastify/fastify | [#5763](prs/auto-web-fastify-fastify-5763.md) | chore: Conditionally require pino if logger is enabled |
| fastify/fastify | [#6224](prs/auto-web-fastify-fastify-6224.md) | docs(decorators): fix TypeScript inconsistency |
| firecracker-microvm/firecracker | [#4428](prs/auto-web-firecracker-microvm-firecracker-4428.md) | Add ACPI support for x86_64 |
| firecracker-microvm/firecracker | [#4797](prs/auto-web-firecracker-microvm-firecracker-4797.md) | feat: Enable gdb debugging on x86 |
| firecracker-microvm/firecracker | [#4799](prs/auto-web-firecracker-microvm-firecracker-4799.md) | Use `readv` for the RX path of the network device to avoid o |
| firecracker-microvm/firecracker | [#5215](prs/auto-web-firecracker-microvm-firecracker-5215.md) | PCI host bridge support |
| foundry-rs/foundry | [#10190](prs/auto-web-foundry-rs-foundry-10190.md) | feat(forge): coverage guided fuzzing & time based campaigns  |
| foundry-rs/foundry | [#11547](prs/auto-web-foundry-rs-foundry-11547.md) | feat(`forge`): backtraces |
| foundry-rs/foundry | [#8571](prs/auto-web-foundry-rs-foundry-8571.md) | feat(cheatcode): `startDebugTraceRecording` and `stopDebugTr |
| gatsbyjs/gatsby | [#38805](prs/auto-web-gatsbyjs-gatsby-38805.md) | perf(gatsby): add a way to skip tracking inline objects |
| gatsbyjs/gatsby | [#38974](prs/auto-web-gatsbyjs-gatsby-38974.md) | feat: allow dsg/ssr renders without access to datastore if i |
| gatsbyjs/gatsby | [#39082](prs/auto-web-gatsbyjs-gatsby-39082.md) | feat!(gatsby-source-shopify): upgrade from Shopify API versi |
| gatsbyjs/gatsby | [#39349](prs/auto-web-gatsbyjs-gatsby-39349.md) | fix: support node 22 |
| gfx-rs/wgpu | [#5701](prs/auto-web-gfx-rs-wgpu-5701.md) | feat: implement F16 support in shaders |
| gfx-rs/wgpu | [#5714](prs/auto-web-gfx-rs-wgpu-5714.md) | Ensure safety of indirect dispatch |
| gfx-rs/wgpu | [#6291](prs/auto-web-gfx-rs-wgpu-6291.md) | Ray Queries |
| gfx-rs/wgpu | [#6833](prs/auto-web-gfx-rs-wgpu-6833.md) | Builtin function database, for automatic conversions |
| ggml-org/whisper.cpp | [#2133](prs/auto-web-ggml-org-whisper.cpp-2133.md) | Add support for decoding input with ffmpeg (Linux) |
| ggml-org/whisper.cpp | [#2759](prs/auto-web-ggml-org-whisper.cpp-2759.md) | Use miniaudio for direct decoding flac, mp3, ogg and wav |
| ggml-org/whisper.cpp | [#3065](prs/auto-web-ggml-org-whisper.cpp-3065.md) | vad : add initial Voice Activity Detection (VAD) support |
| ggml-org/whisper.cpp | [#3395](prs/auto-web-ggml-org-whisper.cpp-3395.md) | Add support for --carry-initial-prompt |
| gin-gonic/gin | [#3963](prs/auto-web-gin-gonic-gin-3963.md) | refactor(context): refactor `Keys` type to `map[any]any` |
| gin-gonic/gin | [#4145](prs/auto-web-gin-gonic-gin-4145.md) | feat(render): add bson protocol |
| gin-gonic/gin | [#4203](prs/auto-web-gin-gonic-gin-4203.md) | feat(binding): add support for encoding.UnmarshalText in uri |
| gin-gonic/gin | [#4227](prs/auto-web-gin-gonic-gin-4227.md) | chore(bind): return 413 status code when error is `http.MaxB |
| go-chi/chi | [#908](prs/auto-web-go-chi-chi-908.md) | feat(): add CF-Connecting-IP |
| go-chi/chi | [#919](prs/auto-web-go-chi-chi-919.md) | Avoid possible memory leak in compress middleware |
| go-chi/chi | [#967](prs/auto-web-go-chi-chi-967.md) | feat: middleware.ClientIP, a replacement for middleware.Real |
| go-gorm/gorm | [#7014](prs/auto-web-go-gorm-gorm-7014.md) | fix: use reflect.Append when preloading nested associations  |
| go-gorm/gorm | [#7424](prs/auto-web-go-gorm-gorm-7424.md) | (WIP) Implement Generics API |
| go-gorm/gorm | [#7450](prs/auto-web-go-gorm-gorm-7450.md) | fix decimal migrate error. |
| go-gorm/gorm | [#7610](prs/auto-web-go-gorm-gorm-7610.md) | Fix slog logger caller frame detection to output correct sou |
| godotengine/godot | [#102552](prs/auto-web-godotengine-godot-102552.md) | Add shader baker to project exporter. |
| godotengine/godot | [#102987](prs/auto-web-godotengine-godot-102987.md) | [LinuxBSD] Add support for HDR output (Wayland) |
| godotengine/godot | [#94496](prs/auto-web-godotengine-godot-94496.md) | [Windows] Support output to HDR monitors |
| godotengine/godot | [#97210](prs/auto-web-godotengine-godot-97210.md) | Add an ObjectDB Profiling Tool |
| gofiber/fiber | [#2991](prs/auto-web-gofiber-fiber-2991.md) | docs: add docs for new client |
| gofiber/fiber | [#3016](prs/auto-web-gofiber-fiber-3016.md) | feat!(middleware/session): re-write session middleware with  |
| gofiber/fiber | [#3230](prs/auto-web-gofiber-fiber-3230.md) | 🔥 feat: Add Support for Removing Routes |
| gofiber/fiber | [#3434](prs/auto-web-gofiber-fiber-3434.md) | 🔥 feat: Add Support for service dependencies |
| goharbor/harbor | [#19883](prs/auto-web-goharbor-harbor-19883.md) | [new-feature]Add Korean Translation |
| goharbor/harbor | [#21347](prs/auto-web-goharbor-harbor-21347.md) | feat: Single Active Replication |
| goharbor/harbor | [#21718](prs/auto-web-goharbor-harbor-21718.md) | oidclogout |
| goharbor/harbor | [#22311](prs/auto-web-goharbor-harbor-22311.md) | Full Multi-Architecture Enablement for Harbor (amd64 + arm64 |
| gohugoio/hugo | [#13541](prs/auto-web-gohugoio-hugo-13541.md) | Reimplement and simplify Hugo's template system |
| gohugoio/hugo | [#14094](prs/auto-web-gohugoio-hugo-14094.md) | markup/asciidocext: Improve Asciidoctor integration |
| gohugoio/hugo | [#14610](prs/auto-web-gohugoio-hugo-14610.md) | Add css.Build (using ESBuild to transform CSS resources) |
| gohugoio/hugo | [#14896](prs/auto-web-gohugoio-hugo-14896.md) | Add image processing support for AVIF |
| golangci/golangci-lint | [#4437](prs/auto-web-golangci-golangci-lint-4437.md) | feat: new custom linters system |
| golangci/golangci-lint | [#5339](prs/auto-web-golangci-golangci-lint-5339.md) | feat: new linter exclusions system |
| golangci/golangci-lint | [#5506](prs/auto-web-golangci-golangci-lint-5506.md) | feat: migration command |
| golangci/golangci-lint | [#5630](prs/auto-web-golangci-golangci-lint-5630.md) | Add funcorder linter |
| google/flax | [#3922](prs/auto-web-google-flax-3922.md) | Support direct quantization for FP8 matmul |
| google/flax | [#4623](prs/auto-web-google-flax-4623.md) | Implemented spectral norm in NNX |
| google/flax | [#4948](prs/auto-web-google-flax-4948.md) | Add compute_flops and compute_vjp_flops options to `nnx.tabu |
| google/flax | [#5257](prs/auto-web-google-flax-5257.md) | Add intermediate value captures (extends #4925) |
| google/gvisor | [#10512](prs/auto-web-google-gvisor-10512.md) | Add vllm benchmark |
| google/gvisor | [#11291](prs/auto-web-google-gvisor-11291.md) | Add a new RPC `ConnectWithCreds` to allow gofer to connect t |
| google/gvisor | [#12791](prs/auto-web-google-gvisor-12791.md) | feat(shim): implement containerd Task.Update for cgroup resi |
| google/gvisor | [#13034](prs/auto-web-google-gvisor-13034.md) | feat: Support running createContainer hooks in CDI spec |
| google/jax | [#21394](prs/auto-web-google-jax-21394.md) | Implement LRU cache eviction for persistent compilation cach |
| google/jax | [#22843](prs/auto-web-google-jax-22843.md) | feat(lib): add real-valued implementation of `jax.scipy.spec |
| google/jax | [#22887](prs/auto-web-google-jax-22887.md) | [Pallas] Add pallas distributed computation tutorial |
| google/jax | [#28810](prs/auto-web-google-jax-28810.md) | added solve_sylvester and accompanying tests |
| gradio-app/gradio | [#10635](prs/auto-web-gradio-app-gradio-10635.md) | Refactor and redesign `ImageEditor` component |
| gradio-app/gradio | [#10984](prs/auto-web-gradio-app-gradio-10984.md) | Let Gradio apps also be MCP Servers |
| gradio-app/gradio | [#11712](prs/auto-web-gradio-app-gradio-11712.md) | Publish `gr.Dataframe` as standalone library |
| gradio-app/gradio | [#9339](prs/auto-web-gradio-app-gradio-9339.md) | Ssr part 2 |
| grafana/grafana | [#85838](prs/auto-web-grafana-grafana-85838.md) | Gops: Add configuration tracker on the existing IRM page |
| grafana/grafana | [#96329](prs/auto-web-grafana-grafana-96329.md) | AppPlatform: Introduce experimental Github integration for d |
| grafana/loki | [#14004](prs/auto-web-grafana-loki-14004.md) | docs: Updated Fluent Bit docs to use official plugin + Sandb |
| grafana/loki | [#14517](prs/auto-web-grafana-loki-14517.md) | docs: Deploy Loki Helm on AWS guide |
| grafana/loki | [#16497](prs/auto-web-grafana-loki-16497.md) | docs: Getting started rewrite |
| grafana/loki | [#18931](prs/auto-web-grafana-loki-18931.md) | feat: add logfmt parse support to the v2 query engine |
| grafana/tempo | [#5213](prs/auto-web-grafana-tempo-5213.md) | [DOC] Add tail sampling policy doc |
| grafana/tempo | [#6754](prs/auto-web-grafana-tempo-6754.md) | v3.0: Add new architecture doc section |
| grafana/tempo | [#6770](prs/auto-web-grafana-tempo-6770.md) | [DOC] Updates for the skill files; update README for agents |
| grafana/tempo | [#6866](prs/auto-web-grafana-tempo-6866.md) | [Feature] Support Math in TraceQL Metrics |
| grpc/grpc-go | [#7498](prs/auto-web-grpc-grpc-go-7498.md) | pickfirst: New pick first policy for dualstack |
| grpc/grpc-go | [#7677](prs/auto-web-grpc-grpc-go-7677.md) | stats/opentelemetry: introduce tracing propagator and carrie |
| grpc/grpc-go | [#7857](prs/auto-web-grpc-grpc-go-7857.md) | internal/resolver: introduce a new delegating resolver to ha |
| grpc/grpc-go | [#8074](prs/auto-web-grpc-grpc-go-8074.md) | stats/opentelemetry: add trace event for name resolution del |
| hashicorp/consul | [#22790](prs/auto-web-hashicorp-consul-22790.md) | feat(ui): `yarn` -> `pnpm` |
| hashicorp/consul | [#22828](prs/auto-web-hashicorp-consul-22828.md) | supress cves and upgrade go version |
| hashicorp/consul | [#22845](prs/auto-web-hashicorp-consul-22845.md) | code owner updated |
| hashicorp/consul | [#22877](prs/auto-web-hashicorp-consul-22877.md) | Add warning when script checks enabled without ACLs |
| hashicorp/nomad | [#24150](prs/auto-web-hashicorp-nomad-24150.md) | start: allow users to call job start command to start stoppe |
| hashicorp/nomad | [#24810](prs/auto-web-hashicorp-nomad-24810.md) | docs: dynamic host volume specification |
| hashicorp/nomad | [#26178](prs/auto-web-hashicorp-nomad-26178.md) | Add nomad monitor export command |
| hashicorp/nomad | [#27718](prs/auto-web-hashicorp-nomad-27718.md) | acl: downscope `AllowClientOp` to node pool |
| hashicorp/terraform | [#34876](prs/auto-web-hashicorp-terraform-34876.md) | docs: Terraform style guide |
| hashicorp/terraform | [#36258](prs/auto-web-hashicorp-terraform-36258.md) | Backend/azure/update to latest sdks |
| hashicorp/terraform | [#36408](prs/auto-web-hashicorp-terraform-36408.md) | Documentation for linking Stacks |
| hashicorp/terraform | [#36872](prs/auto-web-hashicorp-terraform-36872.md) | Added Terraform backend implementation for OCI Object Storag |
| hashicorp/vault | [#24903](prs/auto-web-hashicorp-vault-24903.md) | VAULT-22483: Audit `filter` docs |
| hashicorp/vault | [#25594](prs/auto-web-hashicorp-vault-25594.md) | Secrets Import documentation |
| hashicorp/vault | [#29047](prs/auto-web-hashicorp-vault-29047.md) | Allow Configuration of Azure Secret Engine, including WIF fo |
| hashicorp/vault | [#30753](prs/auto-web-hashicorp-vault-30753.md) | PKI SCEP documentation updates |
| helm/helm | [#12962](prs/auto-web-helm-helm-12962.md) | feat: Added multi-platform plugin hook support |
| helm/helm | [#13154](prs/auto-web-helm-helm-13154.md) | Allow post-renderer to process hooks |
| helm/helm | [#13586](prs/auto-web-helm-helm-13586.md) | feat: add formatting for errors to make multiline stacktrace |
| helm/helm | [#31343](prs/auto-web-helm-helm-31343.md) | chore: replace mitchellh/gox with goreleaser |
| honojs/hono | [#2675](prs/auto-web-honojs-hono-2675.md) | feat(utils/body): add dot notation support for `parseBody` |
| honojs/hono | [#2813](prs/auto-web-honojs-hono-2813.md) | feat(middleware): Introduce IP Restriction Middleware |
| honojs/hono | [#3491](prs/auto-web-honojs-hono-3491.md) | ci: Display performance measurement results as custom metric |
| honojs/hono | [#4291](prs/auto-web-honojs-hono-4291.md) | feat(serve-static): use `join` to correct path resolution |
| huggingface/accelerate | [#3097](prs/auto-web-huggingface-accelerate-3097.md) | POC: multiple model/configuration DeepSpeed support |
| huggingface/accelerate | [#3394](prs/auto-web-huggingface-accelerate-3394.md) | Initial FSDP2 support |
| huggingface/accelerate | [#3682](prs/auto-web-huggingface-accelerate-3682.md) | Parallelism config + TP + HSDP + BYODM (Bring Your Own Devic |
| huggingface/accelerate | [#3817](prs/auto-web-huggingface-accelerate-3817.md) | Deepspeed Ulysses/ALST integration |
| huggingface/datasets | [#7015](prs/auto-web-huggingface-datasets-7015.md) | add split argument to Generator |
| huggingface/datasets | [#7105](prs/auto-web-huggingface-datasets-7105.md) | Use `huggingface_hub` cache |
| huggingface/datasets | [#7207](prs/auto-web-huggingface-datasets-7207.md) | apply formatting after iter_arrow to speed up format -> map, |
| huggingface/datasets | [#7690](prs/auto-web-huggingface-datasets-7690.md) | HDF5 support |
| huggingface/peft | [#1326](prs/auto-web-huggingface-peft-1326.md) | Adding BOFT: Parameter-Efficient Orthogonal Finetuning via B |
| huggingface/peft | [#1491](prs/auto-web-huggingface-peft-1491.md) | Integrate X-LoRA |
| huggingface/peft | [#2644](prs/auto-web-huggingface-peft-2644.md) | Add Arrow + GenKnowSub to LoRA |
| huggingface/peft | [#2987](prs/auto-web-huggingface-peft-2987.md) | Add AdaMSS tuner with Adaptive Subspace Allocation (ASA) |
| huggingface/tokenizers | [#1928](prs/auto-web-huggingface-tokenizers-1928.md) | Add type hint, update to pyo3 0.27, add automatic type hint  |
| huggingface/tokenizers | [#1970](prs/auto-web-huggingface-tokenizers-1970.md) | Fix node-release: all platforms, zig cross-compilation, univ |
| huggingface/tokenizers | [#1995](prs/auto-web-huggingface-tokenizers-1995.md) | Refactor a bit add_tokens logic: fix bytelevel decode of add |
| huggingface/tokenizers | [#2034](prs/auto-web-huggingface-tokenizers-2034.md) | Fix node release |
| huggingface/transformers | [#29886](prs/auto-web-huggingface-transformers-29886.md) | Add SuperGlue model |
| huggingface/transformers | [#30530](prs/auto-web-huggingface-transformers-30530.md) | Add ViTPose |
| huggingface/trl | [#1181](prs/auto-web-huggingface-trl-1181.md) | Kto trainer |
| huggingface/trl | [#1540](prs/auto-web-huggingface-trl-1540.md) | PPO / Reinforce Trainers |
| huggingface/trl | [#2127](prs/auto-web-huggingface-trl-2127.md) | 🐾 Process-supervised RM Trainer |
| huggingface/trl | [#3072](prs/auto-web-huggingface-trl-3072.md) | 👁️ [GRPO] Add VLM training capabilities to the trainer |
| hyperium/hyper | [#3523](prs/auto-web-hyperium-hyper-3523.md) | feat(http1): support configurable `max_headers` |
| hyperium/hyper | [#3637](prs/auto-web-hyperium-hyper-3637.md) | feat(http1): add support for receiving trailer fields |
| hyperium/hyper | [#3660](prs/auto-web-hyperium-hyper-3660.md) | chore: fix unexpected cfg warning |
| hyperium/hyper | [#3729](prs/auto-web-hyperium-hyper-3729.md) | Change graceful_shutdown function behavior. |
| hyperium/tonic | [#1670](prs/auto-web-hyperium-tonic-1670.md) | Upgrade to Hyper 1.0 & Axum 0.7 |
| hyperium/tonic | [#2320](prs/auto-web-hyperium-tonic-2320.md) | feat(grpc): Add `protobuf` codegen |
| hyperium/tonic | [#2363](prs/auto-web-hyperium-tonic-2363.md) | feat(grpc): add aggregate_states in child_manager |
| hyperium/tonic | [#2570](prs/auto-web-hyperium-tonic-2570.md) | feat(grpc): Implement PickFirst load balancer |
| ibis-project/ibis | [#11595](prs/auto-web-ibis-project-ibis-11595.md) | feat(singlestoredb): add SingleStoreDB backend |
| ibis-project/ibis | [#8239](prs/auto-web-ibis-project-ibis-8239.md) | feat(risingwave): add streaming DDLs |
| ibis-project/ibis | [#8917](prs/auto-web-ibis-project-ibis-8917.md) | refactor(api): restrict arbitrary input nesting |
| ibis-project/ibis | [#9096](prs/auto-web-ibis-project-ibis-9096.md) | feat(api): move from .case() to .cases() |
| iced-rs/iced | [#2334](prs/auto-web-iced-rs-iced-2334.md) | Adding feature: Image rotation |
| iced-rs/iced | [#2793](prs/auto-web-iced-rs-iced-2793.md) | Fix the initial candidate window position |
| iced-rs/iced | [#2822](prs/auto-web-iced-rs-iced-2822.md) | More syntaxes for `iced_highlighter` |
| iced-rs/iced | [#2918](prs/auto-web-iced-rs-iced-2918.md) | Report cursor size to input method |
| influxdata/influxdb | [#25594](prs/auto-web-influxdata-influxdb-25594.md) | feat: Modify optimized compaction to cover edge cases |
| influxdata/influxdb | [#25982](prs/auto-web-influxdata-influxdb-25982.md) | feat: add optional token hashing |
| influxdata/influxdb | [#27312](prs/auto-web-influxdata-influxdb-27312.md) | fix: config environment override improvements |
| influxdata/influxdb | [#27370](prs/auto-web-influxdata-influxdb-27370.md) | feat: make /health and /ready available early |
| ionic-team/ionic-framework | [#30246](prs/auto-web-ionic-team-ionic-framework-30246.md) | feat(tab-button): support new badge hint features |
| ionic-team/ionic-framework | [#30831](prs/auto-web-ionic-team-ionic-framework-30831.md) | feat(react-router): upgrade to react router 6 |
| ionic-team/ionic-framework | [#30873](prs/auto-web-ionic-team-ionic-framework-30873.md) | feat(chip): add recipe and variables |
| ionic-team/ionic-framework | [#31043](prs/auto-web-ionic-team-ionic-framework-31043.md) | feat(badge): add recipe and tokens |
| istio/istio | [#50328](prs/auto-web-istio-istio-50328.md) | Idempotency for istio-iptables apply flow |
| istio/istio | [#51828](prs/auto-web-istio-istio-51828.md) | V2 IP AutoAllocation Controller + Basic Ambient Support |
| istio/istio | [#55419](prs/auto-web-istio-istio-55419.md) | krt: add nested join collection |
| istio/istio | [#56844](prs/auto-web-istio-istio-56844.md) | Ambient Multicluster SplitHorizon WDS Implementation |
| jaegertracing/jaeger | [#8160](prs/auto-web-jaegertracing-jaeger-8160.md) | [jaeger_mcp] replace logging of MCP methods with tracing |
| jesseduffield/lazygit | [#3825](prs/auto-web-jesseduffield-lazygit-3825.md) | Support hyperlinks from pagers |
| jesseduffield/lazygit | [#4117](prs/auto-web-jesseduffield-lazygit-4117.md) | Allow to switch branches in Commit View (#4115) |
| jesseduffield/lazygit | [#4130](prs/auto-web-jesseduffield-lazygit-4130.md) | Add ability to configure branch color patterns using regex |
| jesseduffield/lazygit | [#4525](prs/auto-web-jesseduffield-lazygit-4525.md) | Clean up the configuration of where a custom command's outpu |
| jestjs/jest | [#15619](prs/auto-web-jestjs-jest-15619.md) | perf: migrate `resolve` and `resolve.exports` to `unrs-resol |
| jestjs/jest | [#16053](prs/auto-web-jestjs-jest-16053.md) | feat(jest-mock): add `mock.whenCalledWith(...)` |
| jestjs/jest | [#16074](prs/auto-web-jestjs-jest-16074.md) | feat: support `require(esm)` |
| jestjs/jest | [#16141](prs/auto-web-jestjs-jest-16141.md) | feat: allow custom runner configuration options (tuple forma |
| JetBrains/kotlin | [#5875](prs/auto-web-jetbrains-kotlin-5875.md) | [Wasm] Replace first stage test config with phased CLI infra |
| JuliaLang/julia | [#53219](prs/auto-web-julialang-julia-53219.md) | Refactor CodeInfo/CodeInstance separation and interfaces |
| JuliaLang/julia | [#53719](prs/auto-web-julialang-julia-53719.md) | Canonicalize names of nested functions by keeping a more fin |
| JuliaLang/julia | [#54372](prs/auto-web-julialang-julia-54372.md) | Add takestring!(x) to create a string from the content of x, |
| JuliaLang/julia | [#54653](prs/auto-web-julialang-julia-54653.md) | Create `Base.Fix` as general `Fix1`/`Fix2` for partially-app |
| junegunn/fzf | [#4534](prs/auto-web-junegunn-fzf-4534.md) | Introduce 'raw' mode |
| junegunn/fzf | [#4605](prs/auto-web-junegunn-fzf-4605.md) | Add fish completion support |
| junegunn/fzf | [#4630](prs/auto-web-junegunn-fzf-4630.md) | shell: nushell integration scripts |
| junegunn/fzf | [#4731](prs/auto-web-junegunn-fzf-4731.md) | fish: Completion script rewrite (SHIFT-TAB) |
| jupyterlab/jupyterlab | [#15948](prs/auto-web-jupyterlab-jupyterlab-15948.md) | Much smaller "Last Modified" column, date |
| jupyterlab/jupyterlab | [#17363](prs/auto-web-jupyterlab-jupyterlab-17363.md) | If subshells are supported by the kernel, send comm messages |
| jupyterlab/jupyterlab | [#17986](prs/auto-web-jupyterlab-jupyterlab-17986.md) | Debugger: display sources in main area widgets |
| jupyterlab/jupyterlab | [#18619](prs/auto-web-jupyterlab-jupyterlab-18619.md) | Improve focus indicators |
| k3s-io/k3s | [#10973](prs/auto-web-k3s-io-k3s-10973.md) | Auto import images for containerd image store |
| k3s-io/k3s | [#11329](prs/auto-web-k3s-io-k3s-11329.md) | Rework loadbalancer server selection logic |
| k3s-io/k3s | [#12466](prs/auto-web-k3s-io-k3s-12466.md) | Add K3s GOVERNANCE.md |
| k3s-io/k3s | [#9340](prs/auto-web-k3s-io-k3s-9340.md) | Readd `k3s secrets-encrypt rotate-keys` with correct support |
| kata-containers/kata-containers | [#10559](prs/auto-web-kata-containers-kata-containers-10559.md) | coco: Implement trusted ephemeral data storage |
| kata-containers/kata-containers | [#11828](prs/auto-web-kata-containers-kata-containers-11828.md) | runtime-rs: introduce VM template lifecycle and integration |
| kata-containers/kata-containers | [#12635](prs/auto-web-kata-containers-kata-containers-12635.md) | runtime-rs: Update docs for runtime-rs |
| kata-containers/kata-containers | [#8870](prs/auto-web-kata-containers-kata-containers-8870.md) | port attestation agent from CCv0 branch to main branch |
| keras-team/keras | [#21551](prs/auto-web-keras-team-keras-21551.md) | feat(quantization): Add GPTQ n-bit quantization support |
| keras-team/keras | [#21572](prs/auto-web-keras-team-keras-21572.md) | Add Distillation API to Keras |
| keras-team/keras | [#21762](prs/auto-web-keras-team-keras-21762.md) | Added OrbaxCheckpoint for keras 3.0 for Data centric saving  |
| keras-team/keras | [#21903](prs/auto-web-keras-team-keras-21903.md) | Orbax Loading and Sharding Support feature |
| knative/serving | [#15066](prs/auto-web-knative-serving-15066.md) | Integrate net-certmanager in Serving |
| knative/serving | [#15503](prs/auto-web-knative-serving-15503.md) | Ensure ContainerHealthy condition is set back to True |
| knative/serving | [#16042](prs/auto-web-knative-serving-16042.md) | Introduce new SecurePodDefaults options |
| knative/serving | [#16078](prs/auto-web-knative-serving-16078.md) | add default conditions to PA to avoid potential race conditi |
| kubernetes-sigs/cluster-api | [#10897](prs/auto-web-kubernetes-sigs-cluster-api-10897.md) | 📖 Proposal: Improving status in CAPI resources |
| kubernetes-sigs/cluster-api | [#10997](prs/auto-web-kubernetes-sigs-cluster-api-10997.md) | ✨ Implement utils for v1beta2 conditions |
| kubernetes-sigs/cluster-api | [#11234](prs/auto-web-kubernetes-sigs-cluster-api-11234.md) | ✨ Add v1beta2 structs to object status |
| kubernetes-sigs/cluster-api | [#12329](prs/auto-web-kubernetes-sigs-cluster-api-12329.md) | 📖 Propagating taints from Cluster API to Nodes |
| kubernetes-sigs/controller-runtime | [#2783](prs/auto-web-kubernetes-sigs-controller-runtime-2783.md) | ⚠️ Source, Event, Predicate, Handler: Add generics support |
| kubernetes-sigs/controller-runtime | [#3121](prs/auto-web-kubernetes-sigs-controller-runtime-3121.md) | 📖 Add a design for supporting warm replicas |
| kubernetes-sigs/controller-runtime | [#3192](prs/auto-web-kubernetes-sigs-controller-runtime-3192.md) | ✨ Implement warm replica support for controllers |
| kubernetes-sigs/controller-runtime | [#3262](prs/auto-web-kubernetes-sigs-controller-runtime-3262.md) | ⚠️ Migration to the new events API |
| kubernetes-sigs/kustomize | [#5512](prs/auto-web-kubernetes-sigs-kustomize-5512.md) | Fix running docs site with docker |
| kubernetes-sigs/kustomize | [#5544](prs/auto-web-kubernetes-sigs-kustomize-5544.md) | Run kustomize build with kustomize localize and add a no-ver |
| kubernetes-sigs/kustomize | [#5771](prs/auto-web-kubernetes-sigs-kustomize-5771.md) | fix: Allow patches with empty files with multiple newlines o |
| kubernetes-sigs/kustomize | [#6016](prs/auto-web-kubernetes-sigs-kustomize-6016.md) | fix: support helm v4 beside v3 |
| kubernetes/enhancements | [#4384](prs/auto-web-kubernetes-enhancements-4384.md) | KEP 4381: add structured parameters for dynamic resource all |
| kubernetes/enhancements | [#4565](prs/auto-web-kubernetes-enhancements-4565.md) | KEP-4563: EvictionRequest API |
| kubernetes/enhancements | [#5136](prs/auto-web-kubernetes-enhancements-5136.md) | Add KEP for DRA: Extended Resource |
| kubernetes/kubernetes | [#102884](prs/auto-web-kubernetes-kubernetes-102884.md) | In-place Pod Vertical Scaling feature |
| kubernetes/kubernetes | [#116429](prs/auto-web-kubernetes-kubernetes-116429.md) | Add SidecarContainers feature |
| kubernetes/kubernetes | [#124519](prs/auto-web-kubernetes-kubernetes-124519.md) | Remove gcp in-tree cloud provider and credential providers |
| kubernetes/kubernetes | [#126096](prs/auto-web-kubernetes-kubernetes-126096.md) | kubelet: new kubelet config option for disabling group oom k |
| kubernetes/kubernetes | [#132706](prs/auto-web-kubernetes-kubernetes-132706.md) | DRA API: graduation to GA |
| kubevirt/kubevirt | [#11445](prs/auto-web-kubevirt-kubevirt-11445.md) | [release-1.1] Deprecate cpu and memory exceeds alerts |
| kubevirt/kubevirt | [#13744](prs/auto-web-kubevirt-kubevirt-13744.md) | virt-launcher, nichotplug: Manage Link State for vNICs |
| kubevirt/kubevirt | [#14365](prs/auto-web-kubevirt-kubevirt-14365.md) | VEP-10: Add support for DRA devices in VMI |
| kubevirt/kubevirt | [#15123](prs/auto-web-kubevirt-kubevirt-15123.md) | VMpool: Add UpdateStrategy support with Proactive, Opportuni |
| kysely-org/kysely | [#1316](prs/auto-web-kysely-org-kysely-1316.md) | Support json_agg(column_ref) |
| kysely-org/kysely | [#1601](prs/auto-web-kysely-org-kysely-1601.md) | feat: add `elseRef` in `eb.case()` |
| kysely-org/kysely | [#871](prs/auto-web-kysely-org-kysely-871.md) | add modifyEnd to insert, update and delete query builders |
| kysely-org/kysely | [#925](prs/auto-web-kysely-org-kysely-925.md) | feat: add HandleEmtpyInListsPlugin. |
| labstack/echo | [#2574](prs/auto-web-labstack-echo-2574.md) | binder: allow binding to a nil map |
| labstack/echo | [#2892](prs/auto-web-labstack-echo-2892.md) | Add new function "StatusCode in httperror.go" |
| lampepfl/dotty | [#20061](prs/auto-web-lampepfl-dotty-20061.md) | Typeclass experiments refactored |
| lampepfl/dotty | [#21693](prs/auto-web-lampepfl-dotty-21693.md) | Implement SIP-61 `@unroll` annotation |
| lampepfl/dotty | [#22597](prs/auto-web-lampepfl-dotty-22597.md) | Add expression compiler |
| lampepfl/dotty | [#23566](prs/auto-web-lampepfl-dotty-23566.md) | Explicitly null check the stdlib |
| langchain-ai/langchain | [#20881](prs/auto-web-langchain-ai-langchain-20881.md) | [experimental][llms][OllamaFunctions] Add bind_tools and wit |
| langchain-ai/langchain | [#22779](prs/auto-web-langchain-ai-langchain-22779.md) | unstructured, community, initialize langchain-unstructured p |
| langchain-ai/langchain | [#26245](prs/auto-web-langchain-ai-langchain-26245.md) | added FalkorDB vector store support i.e implementation, test |
| langchain-ai/langchain | [#29063](prs/auto-web-langchain-ai-langchain-29063.md) | community[minor]: Refactoring PyMuPDF parser, loader and add |
| langchain-ai/langgraph | [#2196](prs/auto-web-langchain-ai-langgraph-2196.md) | docs: concepts for cloud and doc-reorg |
| langchain-ai/langgraph | [#4486](prs/auto-web-langchain-ai-langgraph-4486.md) | Cache nodes/tasks |
| langchain-ai/langgraph | [#5243](prs/auto-web-langchain-ai-langgraph-5243.md) | feat(langgraph): new context api (replacing `config['configu |
| langchain-ai/langgraph | [#6482](prs/auto-web-langchain-ai-langgraph-6482.md) | feat: custom encryption at rest |
| laravel/laravel | [#6335](prs/auto-web-laravel-laravel-6335.md) | Implement L11 welcome page design |
| laravel/laravel | [#6536](prs/auto-web-laravel-laravel-6536.md) | [11.x] remove `APP_TIMEZONE` environment variable |
| laravel/laravel | [#6714](prs/auto-web-laravel-laravel-6714.md) | Ignore Laravel compiled views for Vite |
| laravel/laravel | [#6778](prs/auto-web-laravel-laravel-6778.md) | Remove axios and enable ignore-scripts |
| launchbadge/sqlx | [#3126](prs/auto-web-launchbadge-sqlx-3126.md) | Make Encode return a result |
| launchbadge/sqlx | [#3188](prs/auto-web-launchbadge-sqlx-3188.md) | feat(cube): support postgres cube |
| launchbadge/sqlx | [#3334](prs/auto-web-launchbadge-sqlx-3334.md) | Fix: nextest cleanup race condition |
| launchbadge/sqlx | [#3723](prs/auto-web-launchbadge-sqlx-3723.md) | Add SqlStr |
| leptos-rs/leptos | [#3063](prs/auto-web-leptos-rs-leptos-3063.md) | Makes the `wasm32-wasip1/2` target a first-class citizen for |
| leptos-rs/leptos | [#3091](prs/auto-web-leptos-rs-leptos-3091.md) | Add support for user-supplied executors |
| leptos-rs/leptos | [#3640](prs/auto-web-leptos-rs-leptos-3640.md) | Erased mode in CI |
| leptos-rs/leptos | [#4273](prs/auto-web-leptos-rs-leptos-4273.md) | Resupport `From<Fn() -> T> for Signal<T>`, `ArcSignal<T>`, ` |
| Lightning-AI/pytorch-lightning | [#19846](prs/auto-web-lightning-ai-pytorch-lightning-19846.md) | (1/n) Support 2D Parallelism |
| Lightning-AI/pytorch-lightning | [#20545](prs/auto-web-lightning-ai-pytorch-lightning-20545.md) | Generic weight averaging callback that supports EMA |
| Lightning-AI/pytorch-lightning | [#20775](prs/auto-web-lightning-ai-pytorch-lightning-20775.md) | Fix double iteration bug when resumed from a checkpoint |
| Lightning-AI/pytorch-lightning | [#20896](prs/auto-web-lightning-ai-pytorch-lightning-20896.md) | feat: Default to `RichProgressBar` and `RichModelSummary` if |
| linkerd/linkerd2 | [#11905](prs/auto-web-linkerd-linkerd2-11905.md) | Introduce new external endpoints controller |
| linkerd/linkerd2 | [#11948](prs/auto-web-linkerd-linkerd2-11948.md) | Add an endpoints reconciler component for external workloads |
| linkerd/linkerd2 | [#12195](prs/auto-web-linkerd-linkerd2-12195.md) | Set proxy-injector, tap-injector and jaeger-injector mutatin |
| linkerd/linkerd2 | [#13206](prs/auto-web-linkerd-linkerd2-13206.md) | policy: Serve EgressNetwork responses |
| lit/lit | [#4515](prs/auto-web-lit-lit-4515.md) | [labs/ssr] fix patched directives memory leak |
| lit/lit | [#4575](prs/auto-web-lit-lit-4575.md) | [labs/nextjs, labs/ssr-react, lit/react] Add support for Nex |
| lit/lit | [#4615](prs/auto-web-lit-lit-4615.md) | Add @lit-labs/signals package |
| lit/lit | [#4755](prs/auto-web-lit-lit-4755.md) | [labs/ssr] Implement SSR custom elements event handling |
| llvm/llvm-project | [#102323](prs/auto-web-llvm-llvm-project-102323.md) | [llvm] Add a simple Telemetry framework |
| llvm/llvm-project | [#113510](prs/auto-web-llvm-llvm-project-113510.md) | [RFC] Initial implementation of P2719 |
| llvm/llvm-project | [#84983](prs/auto-web-llvm-llvm-project-84983.md) | nonblocking/nonallocating attributes (was: nolock/noalloc) |
| mantinedev/mantine | [#5910](prs/auto-web-mantinedev-mantine-5910.md) | useLocalStorage and useSessionStorage missing dependencies |
| mantinedev/mantine | [#8093](prs/auto-web-mantinedev-mantine-8093.md) | feat(llm.txt): adds script to compile llm.txt |
| mantinedev/mantine | [#8439](prs/auto-web-mantinedev-mantine-8439.md) | [@mantine/modals] Enhance contextModal functions |
| mantinedev/mantine | [#8561](prs/auto-web-mantinedev-mantine-8561.md) | 📚 docs(extensions): add new community extensions to the list |
| marko-js/marko | [#2937](prs/auto-web-marko-js-marko-2937.md) | Optimize loop keys |
| marko-js/marko | [#2982](prs/auto-web-marko-js-marko-2982.md) | Handle await closures and delay running renders in pending s |
| marko-js/marko | [#2997](prs/auto-web-marko-js-marko-2997.md) | feat: enable tags api interop by default |
| marko-js/marko | [#3165](prs/auto-web-marko-js-marko-3165.md) | Rolldown test bundling |
| meilisearch/meilisearch | [#4900](prs/auto-web-meilisearch-meilisearch-4900.md) | Indexer edition 2024 |
| meilisearch/meilisearch | [#5254](prs/auto-web-meilisearch-meilisearch-5254.md) | Granular Filterable attribute settings |
| meilisearch/meilisearch | [#6182](prs/auto-web-meilisearch-meilisearch-6182.md) | Support dynamic search rules with pinning |
| metabase/metabase | [#38400](prs/auto-web-metabase-metabase-38400.md) | Caching: new strategies and configuration API |
| metabase/metabase | [#61285](prs/auto-web-metabase-metabase-61285.md) | Documents Feature |
| metabase/metabase | [#62686](prs/auto-web-metabase-metabase-62686.md) | Remote Sync |
| metabase/metabase | [#69037](prs/auto-web-metabase-metabase-69037.md) | docs: transforms updates |
| microsoft/autogen | [#1345](prs/auto-web-microsoft-autogen-1345.md) | Custom Model Client support |
| microsoft/autogen | [#1405](prs/auto-web-microsoft-autogen-1405.md) | Code executors |
| microsoft/autogen | [#2892](prs/auto-web-microsoft-autogen-2892.md) | Mistral Client |
| microsoft/autogen | [#5227](prs/auto-web-microsoft-autogen-5227.md) | Task-Centric Memory |
| microsoft/LightGBM | [#6569](prs/auto-web-microsoft-lightgbm-6569.md) | [c++] Fix `dump_model()` information for root node |
| microsoft/LightGBM | [#6646](prs/auto-web-microsoft-lightgbm-6646.md) | [ci] fix shellcheck warnings in CI scripts |
| microsoft/LightGBM | [#6651](prs/auto-web-microsoft-lightgbm-6651.md) | [python-package] require `scikit-learn>=0.24.2`, make scikit |
| microsoft/LightGBM | [#6857](prs/auto-web-microsoft-lightgbm-6857.md) | [python-package] scikit-learn fit() methods: add eval_X, eva |
| microsoft/onnxruntime | [#24887](prs/auto-web-microsoft-onnxruntime-24887.md) | Add GetCapability/Compile infrastructure for EP ABI |
| microsoft/onnxruntime | [#25187](prs/auto-web-microsoft-onnxruntime-25187.md) | KleidiAI SGEMM/IGEMM/Quantized MatMul - Modular MLAS API Cha |
| microsoft/onnxruntime | [#26815](prs/auto-web-microsoft-onnxruntime-26815.md) | [MLAS] Enable FP16 for Gelu |
| microsoft/onnxruntime | [#26834](prs/auto-web-microsoft-onnxruntime-26834.md) | [MLAS] Add an NHWC implementation of convolution to avoid tr |
| microsoft/playwright | [#31529](prs/auto-web-microsoft-playwright-31529.md) | feat: support client certificates |
| microsoft/playwright | [#31727](prs/auto-web-microsoft-playwright-31727.md) | feat(test runner): `--only-changed` option |
| microsoft/TypeScript | [#40336](prs/auto-web-microsoft-typescript-40336.md) | Template literal types and mapped type 'as' clauses |
| microsoft/TypeScript | [#51387](prs/auto-web-microsoft-typescript-51387.md) | Convert the codebase to modules |
| microsoft/TypeScript | [#57847](prs/auto-web-microsoft-typescript-57847.md) | Control flow analysis for element access with variable index |
| microsoft/TypeScript | [#59767](prs/auto-web-microsoft-typescript-59767.md) | Rewrite relative import extensions with flag |
| milvus-io/milvus | [#36366](prs/auto-web-milvus-io-milvus-36366.md) | feat: Add Text Embedding Function |
| milvus-io/milvus | [#38039](prs/auto-web-milvus-io-milvus-38039.md) | enhance: Add json key inverted index in stats for optimizati |
| milvus-io/milvus | [#44394](prs/auto-web-milvus-io-milvus-44394.md) | feat: support query aggregtion(#36380) |
| milvus-io/milvus | [#47486](prs/auto-web-milvus-io-milvus-47486.md) | enhance: improve the preformance of create partitions |
| minio/minio | [#19068](prs/auto-web-minio-minio-19068.md) | feat: Add Metrics V3 API |
| minio/minio | [#19107](prs/auto-web-minio-minio-19107.md) | Enable replication of SSE-C objects |
| minio/minio | [#19833](prs/auto-web-minio-minio-19833.md) | Add LDAP public key authentication to SFTP |
| minio/minio | [#20033](prs/auto-web-minio-minio-20033.md) | feat: support batch replication prefix slice |
| ml-explore/mlx | [#1325](prs/auto-web-ml-explore-mlx-1325.md) | Custom Metal Kernels from Python |
| ml-explore/mlx | [#2663](prs/auto-web-ml-explore-mlx-2663.md) | Add Masked Scatter |
| ml-explore/mlx | [#541](prs/auto-web-ml-explore-mlx-541.md) | Custom VJP and checkpointing |
| ml-explore/mlx | [#735](prs/auto-web-ml-explore-mlx-735.md) | Fast Inference SDPA op |
| mlflow/mlflow | [#13276](prs/auto-web-mlflow-mlflow-13276.md) | Make spark_udf support Databricks Serverless, Databricks con |
| mlflow/mlflow | [#17676](prs/auto-web-mlflow-mlflow-17676.md) | Job execution backend |
| mlflow/mlflow | [#21789](prs/auto-web-mlflow-mlflow-21789.md) | Add `BatchSpanProcessor` option to decouple trace export fro |
| mlflow/mlflow | [#22145](prs/auto-web-mlflow-mlflow-22145.md) | Add AI Gateway benchmark suite |
| mlflow/mlflow | [#22929](prs/auto-web-mlflow-mlflow-22929.md) | [Admin-UI-3/4] Add Platform Admin pages |
| moby/moby | [#47041](prs/auto-web-moby-moby-47041.md) | Refactor 'resolv.conf' generation |
| moby/moby | [#47679](prs/auto-web-moby-moby-47679.md) | c8d/push: Support `--platform` switch |
| moby/moby | [#47871](prs/auto-web-moby-moby-47871.md) | Portmapper improvements, and options to disable NAT |
| moby/moby | [#49365](prs/auto-web-moby-moby-49365.md) | Improve performance of daemon.Containers() |
| mrdoob/three.js | [#28802](prs/auto-web-mrdoob-three.js-28802.md) | Nodes: Add PixelationNode |
| mrdoob/three.js | [#30870](prs/auto-web-mrdoob-three.js-30870.md) | Added new DevTools |
| mui/material-ui | [#40848](prs/auto-web-mui-material-ui-40848.md) | [material-ui][docs] Add Connect-related content |
| mui/material-ui | [#40967](prs/auto-web-mui-material-ui-40967.md) | [material-ui] Refine checkout template |
| mui/material-ui | [#41932](prs/auto-web-mui-material-ui-41932.md) | [blog] Add Material UI v6 stable release |
| mui/material-ui | [#46416](prs/auto-web-mui-material-ui-46416.md) | [website] Add Case studies to the homepage |
| nats-io/nats-server | [#5014](prs/auto-web-nats-io-nats-server-5014.md) | [ADDED] Distributed Message Tracing |
| nats-io/nats-server | [#6966](prs/auto-web-nats-io-nats-server-6966.md) | (2.12) Initial atomic batch publish |
| nats-io/nats-server | [#7242](prs/auto-web-nats-io-nats-server-7242.md) | Add HTTP proxy support for WebSocket leaf node connections |
| neondatabase/neon | [#6560](prs/auto-web-neondatabase-neon-6560.md) | Persist pg_stat information in pageserver |
| neondatabase/neon | [#6872](prs/auto-web-neondatabase-neon-6872.md) | On-demand WAL download for walsender |
| neondatabase/neon | [#7288](prs/auto-web-neondatabase-neon-7288.md) | Restore running xacts from CLOG on replica startup |
| neovim/neovim | [#31031](prs/auto-web-neovim-neovim-31031.md) | feat(lsp): add `vim.lsp.config` and `vim.lsp.enable` |
| neovim/neovim | [#31631](prs/auto-web-neovim-neovim-31631.md) | feat(treesitter): async parsing |
| neovim/neovim | [#34009](prs/auto-web-neovim-neovim-34009.md) | feat(pack): add built-in plugin manager `vim.pack` |
| nestjs/nest | [#13000](prs/auto-web-nestjs-nest-13000.md) | fix(core,common): 🐛 missing registration handling of `SEARCH |
| nestjs/nest | [#14881](prs/auto-web-nestjs-nest-14881.md) | fix(common): introduce magic file type validator to nestjs c |
| nestjs/nest | [#16218](prs/auto-web-nestjs-nest-16218.md) | feat(microservices): add redis driver identification |
| nestjs/nest | [#16954](prs/auto-web-nestjs-nest-16954.md) | feat(core): add route conflict diagnostics and specificity o |
| nodejs/node | [#53752](prs/auto-web-nodejs-node-53752.md) | lib,src,test,doc: add node:sqlite module |
| nodejs/node | [#54283](prs/auto-web-nodejs-node-54283.md) | module: add --experimental-transform-types flag |
| nodejs/node | [#55085](prs/auto-web-nodejs-node-55085.md) | module: unflag --experimental-require-module |
| nodejs/undici | [#2608](prs/auto-web-nodejs-undici-2608.md) | feat: Implement EventSource |
| nodejs/undici | [#2826](prs/auto-web-nodejs-undici-2826.md) | feat: add new dispatch compose |
| nodejs/undici | [#3118](prs/auto-web-nodejs-undici-3118.md) | feat: dump interceptor |
| nodejs/undici | [#3562](prs/auto-web-nodejs-undici-3562.md) | feat: http caching |
| nrwl/nx | [#22602](prs/auto-web-nrwl-nx-22602.md) | feat(core): add bun package manager |
| nrwl/nx | [#30457](prs/auto-web-nrwl-nx-30457.md) | feat(gradle): add batch runner |
| nrwl/nx | [#34111](prs/auto-web-nrwl-nx-34111.md) | chore(core): build nx to local dist and use nodenext |
| nrwl/nx | [#35340](prs/auto-web-nrwl-nx-35340.md) | feat(core): support filtered array-shape targetDefaults with |
| numba/numba | [#10131](prs/auto-web-numba-numba-10131.md) | Added initial typed set implementation based on typed dict i |
| numba/numba | [#10499](prs/auto-web-numba-numba-10499.md) | Fix swapped shapes in slice assignment error message - Fixes |
| numba/numba | [#9662](prs/auto-web-numba-numba-9662.md) | Type system implementation #1: Added initial implementation  |
| numba/numba | [#9682](prs/auto-web-numba-numba-9682.md) | Python 3.13 support |
| numpy/numpy | [#29129](prs/auto-web-numpy-numpy-29129.md) | ENH: add a casting option 'same_value' and use it in np.asty |
| numpy/numpy | [#29737](prs/auto-web-numpy-numpy-29737.md) | ENH, API: New sorting slots for DType API |
| nushell/nushell | [#14411](prs/auto-web-nushell-nushell-14411.md) | Feature: PWD-per-drive to facilitate working on multiple dri |
| nushell/nushell | [#14906](prs/auto-web-nushell-nushell-14906.md) | Custom command attributes |
| nushell/nushell | [#16079](prs/auto-web-nushell-nushell-16079.md) | fix(engine, type-system)!: enforce assignment type annotatio |
| nushell/nushell | [#16859](prs/auto-web-nushell-nushell-16859.md) | Plugin: support custom completions in command flags |
| NVIDIA/Megatron-LM | [#2363](prs/auto-web-nvidia-megatron-lm-2363.md) | Add MTP support for hybrid models |
| NVIDIA/Megatron-LM | [#3029](prs/auto-web-nvidia-megatron-lm-3029.md) | Move tensor offload/onload out of RL code |
| NVIDIA/Megatron-LM | [#4429](prs/auto-web-nvidia-megatron-lm-4429.md) | Adding code for Flextron |
| NVIDIA/Megatron-LM | [#4689](prs/auto-web-nvidia-megatron-lm-4689.md) | Fix unit tests |
| NVIDIA/NeMo | [#10874](prs/auto-web-nvidia-nemo-10874.md) | NeMo 2.0 SFT PEFT notebooks |
| NVIDIA/NeMo | [#11282](prs/auto-web-nvidia-nemo-11282.md) | Sortformer Diarizer 4spk v1 model PR Part 1: models, modules |
| NVIDIA/NeMo | [#13437](prs/auto-web-nvidia-nemo-13437.md) | OneLogger Integration |
| NVIDIA/NeMo | [#8743](prs/auto-web-nvidia-nemo-8743.md) | Open source export and deploy modules |
| ocornut/imgui | [#7381](prs/auto-web-ocornut-imgui-7381.md) | Backends: SDL3: Fix leak of SDL_GetGamepads() return value |
| ocornut/imgui | [#7865](prs/auto-web-ocornut-imgui-7865.md) | CI: Add manual trigger for 'workflow_run' builds |
| ocornut/imgui | [#7925](prs/auto-web-ocornut-imgui-7925.md) | Add native UTF8 support for InputText and remove ImWchar buf |
| ocornut/imgui | [#7954](prs/auto-web-ocornut-imgui-7954.md) | Fix C++26 invalid enum operation |
| ollama/ollama | [#10415](prs/auto-web-ollama-ollama-10415.md) | tools: refactor tool call parsing and enable streaming |
| ollama/ollama | [#11090](prs/auto-web-ollama-ollama-11090.md) | New Memory Management |
| ollama/ollama | [#16031](prs/auto-web-ollama-ollama-16031.md) | runner: Remove CGO engines, use llama-server exclusively for |
| ollama/ollama | [#6279](prs/auto-web-ollama-ollama-6279.md) | feat: Introduce K/V Context Quantisation (vRAM improvements) |
| onnx/onnx | [#5906](prs/auto-web-onnx-onnx-5906.md) | Support register custom OpSchema by python |
| onnx/onnx | [#6283](prs/auto-web-onnx-onnx-6283.md) | Add FLOAT4E2M1 support to relevant operators |
| onnx/onnx | [#6443](prs/auto-web-onnx-onnx-6443.md) | Add RMSNormalization to ONNX opset 23 |
| onnx/onnx | [#7030](prs/auto-web-onnx-onnx-7030.md) | Add FLOAT8E8M0 data type |
| open-policy-agent/opa | [#6990](prs/auto-web-open-policy-agent-opa-6990.md) | Add a new inter-query value cache to cache data across queri |
| open-policy-agent/opa | [#7140](prs/auto-web-open-policy-agent-opa-7140.md) | Update docs and server binding addr per OPA v1.0 specs |
| open-policy-agent/opa | [#7446](prs/auto-web-open-policy-agent-opa-7446.md) | feat: new event-based decisions log buffer implementation |
| open-policy-agent/opa | [#7458](prs/auto-web-open-policy-agent-opa-7458.md) | fix: don't panic on format due to unexpected comments |
| open-telemetry/opentelemetry-collector | [#11406](prs/auto-web-open-telemetry-opentelemetry-collector-11406.md) | RFC - Pipeline Component Telemetry |
| open-telemetry/opentelemetry-collector | [#12097](prs/auto-web-open-telemetry-opentelemetry-collector-12097.md) | [confmap] - new feature flag for append merging strategy |
| open-telemetry/opentelemetry-collector | [#12802](prs/auto-web-open-telemetry-opentelemetry-collector-12802.md) | Update receiverhelper for requests that failed to be receive |
| open-telemetry/opentelemetry-collector | [#14412](prs/auto-web-open-telemetry-opentelemetry-collector-14412.md) | Add typed collector resource attributes based on declarative |
| openai/openai-python | [#1850](prs/auto-web-openai-openai-python-1850.md) | fix(logs): redact sensitive headers |
| openai/openai-python | [#1853](prs/auto-web-openai-openai-python-1853.md) | fix(asyncify): avoid hanging process under certain condition |
| openai/openai-python | [#2588](prs/auto-web-openai-openai-python-2588.md) | feat(client): support callable api_key |
| openai/openai-python | [#3326](prs/auto-web-openai-openai-python-3326.md) | [codex] Add Amazon Bedrock Responses support |
| openai/whisper | [#2343](prs/auto-web-openai-whisper-2343.md) | Add option to carry initial_prompt with the sliding window |
| openai/whisper | [#2435](prs/auto-web-openai-whisper-2435.md) | PEP 621: Migrate from setup.py to pyproject.toml |
| openai/whisper | [#2451](prs/auto-web-openai-whisper-2451.md) | Fix: Update torch.load to use weights_only=True to prevent s |
| openai/whisper | [#2487](prs/auto-web-openai-whisper-2487.md) | GitHub Actions: Add Python 3.13 to the testing |
| opencontainers/runc | [#4538](prs/auto-web-opencontainers-runc-4538.md) | Linux Network Devices |
| opencontainers/runc | [#4661](prs/auto-web-opencontainers-runc-4661.md) | skip setup signal notifier for detached container |
| opencontainers/runc | [#4726](prs/auto-web-opencontainers-runc-4726.md) | Add memory policy support |
| opencontainers/runc | [#4832](prs/auto-web-opencontainers-runc-4832.md) | libcontainer/intelrdt: add support for EnableMonitoring fiel |
| opensearch-project/OpenSearch | [#12782](prs/auto-web-opensearch-project-opensearch-12782.md) | [Writable Warm] Composite Directory implementation and integ |
| opensearch-project/OpenSearch | [#13897](prs/auto-web-opensearch-project-opensearch-13897.md) | QueryGroup Resource Tracking framework and implementation |
| opensearch-project/OpenSearch | [#14809](prs/auto-web-opensearch-project-opensearch-14809.md) | Star Tree File Formats |
| opensearch-project/OpenSearch | [#20017](prs/auto-web-opensearch-project-opensearch-20017.md) | Support for HTTP/3 (server side) |
| optuna/optuna | [#5185](prs/auto-web-optuna-optuna-5185.md) | Add GPSampler |
| optuna/optuna | [#5274](prs/auto-web-optuna-optuna-5274.md) | Enhance performance of GPSampler |
| optuna/optuna | [#6039](prs/auto-web-optuna-optuna-6039.md) | Add a module to preprocess solutions for hypervolume improve |
| optuna/optuna | [#6273](prs/auto-web-optuna-optuna-6273.md) | Make the interface of `batched_lbfgsb` module compatible wit |
| oxc-project/oxc | [#15861](prs/auto-web-oxc-project-oxc-15861.md) | feat(linter/plugins): Token-related `SourceCode` APIs (TS ES |
| oxc-project/oxc | [#21392](prs/auto-web-oxc-project-oxc-21392.md) | feat(linter/release): automate oxlint rule version updates |
| oxc-project/oxc | [#3133](prs/auto-web-oxc-project-oxc-3133.md) | feat(transformer): add `object-spread` plugin |
| oxc-project/oxc | [#5387](prs/auto-web-oxc-project-oxc-5387.md) | feat(transformer): support all /regex/ to `new RegExp` trans |
| pallets/flask | [#5647](prs/auto-web-pallets-flask-5647.md) | fix type hint for `cli_runner.invoke` |
| pallets/flask | [#5736](prs/auto-web-pallets-flask-5736.md) | support call template_filter without parens |
| pallets/flask | [#5737](prs/auto-web-pallets-flask-5737.md) | Fix global CONTRIBUTING link |
| pallets/flask | [#5827](prs/auto-web-pallets-flask-5827.md) | clarify 415 vs 400 errors for request.json |
| paradigmxyz/reth | [#15105](prs/auto-web-paradigmxyz-reth-15105.md) | Implement txpool interop support for optimism |
| paradigmxyz/reth | [#18882](prs/auto-web-paradigmxyz-reth-18882.md) | feat: add StaticFileSegment::AccountChangeSets |
| paradigmxyz/reth | [#6222](prs/auto-web-paradigmxyz-reth-6222.md) | Sanitise eth68 announcement |
| paradigmxyz/reth | [#6958](prs/auto-web-paradigmxyz-reth-6958.md) | feat(prune): timeout |
| pgvector/pgvector | [#410](prs/auto-web-pgvector-pgvector-410.md) | Use LWLocks instead of SpinLocks |
| pgvector/pgvector | [#419](prs/auto-web-pgvector-pgvector-419.md) | Add overview comment on how HNSW build works |
| pgvector/pgvector | [#438](prs/auto-web-pgvector-pgvector-438.md) | Remove unnecessary PageIndexTupleOverwrite calls that caused |
| pgvector/pgvector | [#682](prs/auto-web-pgvector-pgvector-682.md) | Update HNSW cost estimatation to utilize search and index in |
| php/php-src | [#13741](prs/auto-web-php-php-src-13741.md) | [RFC] Support object types in BCMath |
| php/php-src | [#14660](prs/auto-web-php-php-src-14660.md) | ext/bcmath: Optimize `bcdiv` processing |
| php/php-src | [#18672](prs/auto-web-php-php-src-18672.md) | Add Uri\WhatWg classes to ext/uri |
| php/php-src | [#18836](prs/auto-web-php-php-src-18836.md) | Add the Uri\Rfc3986\Uri class to ext/uri without wither supp |
| plotly/plotly.py | [#4706](prs/auto-web-plotly-plotly.py-4706.md) | Updates for maplibre maps |
| plotly/plotly.py | [#4790](prs/auto-web-plotly-plotly.py-4790.md) | feat: make plotly-express dataframe agnostic via narwhals |
| plotly/plotly.py | [#4840](prs/auto-web-plotly-plotly.py-4840.md) | Docs updates for Plotly.py version 6 |
| plotly/plotly.py | [#5111](prs/auto-web-plotly-plotly.py-5111.md) | Kaleido docs updates for v1 |
| pmndrs/jotai | [#2363](prs/auto-web-pmndrs-jotai-2363.md) | Improve performance of recomputeDependents |
| pmndrs/jotai | [#3147](prs/auto-web-pmndrs-jotai-3147.md) | test: migrate to Vitest fake timers, remove @testing-library |
| pmndrs/jotai | [#3150](prs/auto-web-pmndrs-jotai-3150.md) | breaking: drop atom.unstable_is |
| pmndrs/jotai | [#3293](prs/auto-web-pmndrs-jotai-3293.md) | breaking(internals): avoid getInternalBuildingBlock function |
| pmndrs/zustand | [#2298](prs/auto-web-pmndrs-zustand-2298.md) | Update docs related to SSR/Hydration and SSR Apps |
| pmndrs/zustand | [#2580](prs/auto-web-pmndrs-zustand-2580.md) | fix(types)!: require complete state if `setState`'s `replace |
| pmndrs/zustand | [#2912](prs/auto-web-pmndrs-zustand-2912.md) | chore(eslint): migrate to flat config and simplify |
| pmndrs/zustand | [#3246](prs/auto-web-pmndrs-zustand-3246.md) | docs: created the new TypeScript Beginner Guide |
| pocketbase/pocketbase | [#5179](prs/auto-web-pocketbase-pocketbase-5179.md) | Fix days calculation bug for the old logs |
| pocketbase/pocketbase | [#6744](prs/auto-web-pocketbase-pocketbase-6744.md) | Generate webp thumbnails |
| pocketbase/pocketbase | [#6860](prs/auto-web-pocketbase-pocketbase-6860.md) | Support multiline cast expressions in view |
| pocketbase/pocketbase | [#6947](prs/auto-web-pocketbase-pocketbase-6947.md) | Probability Distribution Bug in Regex-Based Random String Ge |
| pola-rs/polars | [#17995](prs/auto-web-pola-rs-polars-17995.md) | feat(python!): Use Altair in DataFrame.plot |
| pola-rs/polars | [#19894](prs/auto-web-pola-rs-polars-19894.md) | feat: Add `index_of()` function to `Series` and `Expr` |
| pola-rs/polars | [#22840](prs/auto-web-pola-rs-polars-22840.md) | feat: Reinterpret binary data to fixed size numerical array |
| preactjs/preact | [#4364](prs/auto-web-preactjs-preact-4364.md) | feat: Support MathML namespace |
| preactjs/preact | [#4413](prs/auto-web-preactjs-preact-4413.md) | graciously handle array shuffling |
| preactjs/preact | [#4557](prs/auto-web-preactjs-preact-4557.md) | feat: Add `ElementRef` type to compat |
| preactjs/preact | [#4618](prs/auto-web-preactjs-preact-4618.md) | Allow for Context as JSX |
| PrefectHQ/prefect | [#12830](prs/auto-web-prefecthq-prefect-12830.md) | Automations SDK Methods |
| PrefectHQ/prefect | [#14122](prs/auto-web-prefecthq-prefect-14122.md) | Use "nested flow" in place of "subflow" in the docs |
| PrefectHQ/prefect | [#14237](prs/auto-web-prefecthq-prefect-14237.md) | Add upgrade to Prefect 3 Guide |
| PrefectHQ/prefect | [#17285](prs/auto-web-prefecthq-prefect-17285.md) | Airflow migration guide |
| prettier/prettier | [#18277](prs/auto-web-prettier-prettier-18277.md) | Upgrade to latest micromark (markdown only) |
| prisma/prisma | [#28375](prs/auto-web-prisma-prisma-28375.md) | feat(client): remove library engine |
| prisma/prisma | [#29014](prs/auto-web-prisma-prisma-29014.md) | chore: sanitize QPE connection errors |
| prisma/prisma | [#29038](prs/auto-web-prisma-prisma-29038.md) | feat: query plan caching |
| prisma/prisma | [#29374](prs/auto-web-prisma-prisma-29374.md) | feat(cli): add prisma bootstrap command |
| projectdiscovery/nuclei | [#6290](prs/auto-web-projectdiscovery-nuclei-6290.md) | build: bump all direct modules |
| projectdiscovery/nuclei | [#6322](prs/auto-web-projectdiscovery-nuclei-6322.md) | Support concurrent Nuclei engines in the same process |
| projectdiscovery/nuclei | [#6420](prs/auto-web-projectdiscovery-nuclei-6420.md) | cache, goroutine and unbounded workers management |
| projectdiscovery/nuclei | [#7307](prs/auto-web-projectdiscovery-nuclei-7307.md) | refactor: native tests |
| prometheus/prometheus | [#15687](prs/auto-web-prometheus-prometheus-15687.md) | Float histograms: implement methods for Add/Sub operations u |
| prometheus/prometheus | [#17671](prs/auto-web-prometheus-prometheus-17671.md) | tsdb(wal): st-per-sample initial code and benchmarks |
| protocolbuffers/protobuf | [#21033](prs/auto-web-protocolbuffers-protobuf-21033.md) | fix(php): do not throw deprecated warning on field getters f |
| protocolbuffers/protobuf | [#21754](prs/auto-web-protocolbuffers-protobuf-21754.md) | Change pre-22 poison pill to only log once per affected mess |
| protocolbuffers/protobuf | [#21880](prs/auto-web-protocolbuffers-protobuf-21880.md) | Manually backport Pure Python recursion limit enforcement to |
| protocolbuffers/protobuf | [#23547](prs/auto-web-protocolbuffers-protobuf-23547.md) | Add gencode smoke tests |
| psf/requests | [#6667](prs/auto-web-psf-requests-6667.md) | Avoid reloading root certificates to improve concurrent perf |
| psf/requests | [#6710](prs/auto-web-psf-requests-6710.md) | Move _get_connection to get_connection_with_tls_context |
| psf/requests | [#6716](prs/auto-web-psf-requests-6716.md) | Allow for overriding of specific pool key params |
| psf/requests | [#7272](prs/auto-web-psf-requests-7272.md) | Add inline types to Requests |
| pulumi/pulumi | [#19862](prs/auto-web-pulumi-pulumi-19862.md) | journaling interface inside the engine |
| pulumi/pulumi | [#20082](prs/auto-web-pulumi-pulumi-20082.md) | Run smoke tests in parallel |
| pulumi/pulumi | [#20085](prs/auto-web-pulumi-pulumi-20085.md) | [sdkgen/python] Support properties named "builtins" |
| pulumi/pulumi | [#20089](prs/auto-web-pulumi-pulumi-20089.md) | [sdkgen/python] Remove unnecessary import copy |
| pydantic/pydantic | [#9459](prs/auto-web-pydantic-pydantic-9459.md) | Add pipeline API |
| pymc-devs/pymc | [#7380](prs/auto-web-pymc-devs-pymc-7380.md) | Implement unconstraining transform for LKJCorr |
| pymc-devs/pymc | [#7392](prs/auto-web-pymc-devs-pymc-7392.md) | Refactor model graph and allow suppressing dim lengths |
| pymc-devs/pymc | [#7540](prs/auto-web-pymc-devs-pymc-7540.md) | Add ZarrTrace |
| pymc-devs/pymc | [#8047](prs/auto-web-pymc-devs-pymc-8047.md) | SMC Multiprocessing and Progress Bar Refactor |
| pypa/pip | [#12991](prs/auto-web-pypa-pip-12991.md) | Introduce resumable downloads with --resume-retries |
| pypa/pip | [#13048](prs/auto-web-pypa-pip-13048.md) | Add trusted publisher release workflow |
| pypa/pip | [#13065](prs/auto-web-pypa-pip-13065.md) | Implement a `--group` option for installing from `[dependenc |
| pypa/pip | [#13725](prs/auto-web-pypa-pip-13725.md) | Remove `__pycache__` when package is removed |
| pytest-dev/pytest | [#12168](prs/auto-web-pytest-dev-pytest-12168.md) | Initialize cache directory in isolation |
| pytest-dev/pytest | [#12473](prs/auto-web-pytest-dev-pytest-12473.md) | (fixtures): Replace fixture representation with a class |
| pytest-dev/pytest | [#13738](prs/auto-web-pytest-dev-pytest-13738.md) | Integrate pytest-subtests |
| pytest-dev/pytest | [#13757](prs/auto-web-pytest-dev-pytest-13757.md) | feat: add --require-unique-paramset-ids option skips pytest  |
| python/cpython | [#118450](prs/auto-web-python-cpython-118450.md) | gh-117139: Convert the evaluation stack to stack refs |
| python/cpython | [#124640](prs/auto-web-python-cpython-124640.md) | GH-91048: Add utils for capturing async call stack for async |
| python/cpython | [#137215](prs/auto-web-python-cpython-137215.md) | gh-137026: Add an explainer guide for asyncio |
| python/cpython | [#140310](prs/auto-web-python-cpython-140310.md) | gh-139109: A new tracing JIT compiler frontend for CPython |
| qdrant/qdrant | [#3426](prs/auto-web-qdrant-qdrant-3426.md) | Assign clock tags to internal update operations (and update  |
| qdrant/qdrant | [#6635](prs/auto-web-qdrant-qdrant-6635.md) | Add stopwords support |
| qdrant/qdrant | [#7048](prs/auto-web-qdrant-qdrant-7048.md) | EncodedStorage upsert vector |
| qdrant/qdrant | [#7188](prs/auto-web-qdrant-qdrant-7188.md) | slow requests log |
| quarkusio/quarkus | [#38448](prs/auto-web-quarkusio-quarkus-38448.md) | Initial Observability extension - devservices, devresources, |
| quarkusio/quarkus | [#44473](prs/auto-web-quarkusio-quarkus-44473.md) | Allow Hibernate ORM and Hibernate Reactive to be used in the |
| quarkusio/quarkus | [#48688](prs/auto-web-quarkusio-quarkus-48688.md) | Extension Structure ADR proposal |
| quarkusio/quarkus | [#51063](prs/auto-web-quarkusio-quarkus-51063.md) | Support @Transactional for Hibernate Reactive |
| quickwit-oss/tantivy | [#2405](prs/auto-web-quickwit-oss-tantivy-2405.md) | feat(query): Make `BooleanQuery` supports `minimum_number_sh |
| quickwit-oss/tantivy | [#2516](prs/auto-web-quickwit-oss-tantivy-2516.md) | add RegexPhraseQuery |
| quickwit-oss/tantivy | [#2711](prs/auto-web-quickwit-oss-tantivy-2711.md) | feat: added filter aggregation |
| radix-ui/primitives | [#2934](prs/auto-web-radix-ui-primitives-2934.md) | React 19 compatibility |
| radix-ui/primitives | [#2945](prs/auto-web-radix-ui-primitives-2945.md) | [ScrollArea] Viewport fixes |
| radix-ui/primitives | [#2952](prs/auto-web-radix-ui-primitives-2952.md) | Adds React 19 RC and React-DOM 19 RC to the list of peer dep |
| radix-ui/primitives | [#3614](prs/auto-web-radix-ui-primitives-3614.md) | Prevent render loop in `Popper` |
| rails/rails | [#51674](prs/auto-web-rails-rails-51674.md) | Add `Parameters#expect` to safely filter and require params |
| rails/rails | [#55334](prs/auto-web-rails-rails-55334.md) | Structured Event Reporting in Rails |
| ratatui-org/ratatui | [#1089](prs/auto-web-ratatui-org-ratatui-1089.md) | fix: unicode truncation bug |
| ratatui-org/ratatui | [#2150](prs/auto-web-ratatui-org-ratatui-2150.md) | feat(table): let Cells span multiple columns |
| ratatui-org/ratatui | [#783](prs/auto-web-ratatui-org-ratatui-783.md) | feat: Add `Constraint::Fixed(x)` and `Constraint::Proportion |
| ray-project/ray | [#46911](prs/auto-web-ray-project-ray-46911.md) | [core][experimental] Build an operation-based execution sche |
| ray-project/ray | [#47586](prs/auto-web-ray-project-ray-47586.md) | [core][compiled graphs] Overlap computation and communicatio |
| ray-project/ray | [#56838](prs/auto-web-ray-project-ray-56838.md) | [RLlib] MetricsLogger tweaks+ Stats rewrite |
| ray-project/ray | [#57735](prs/auto-web-ray-project-ray-57735.md) | [Core] Introduce node specific temp-dir specification |
| raysan5/raylib | [#3941](prs/auto-web-raysan5-raylib-3941.md) | make RGFW a custom platform |
| raysan5/raylib | [#4832](prs/auto-web-raysan5-raylib-4832.md) | [rlgl] Add Software Rendering Support |
| raysan5/raylib | [#5169](prs/auto-web-raysan5-raylib-5169.md) | [rcore] Use `FLAG_*` macros where possible |
| raysan5/raylib | [#5764](prs/auto-web-raysan5-raylib-5764.md) | [build.zig] Refactor |
| rclone/rclone | [#7717](prs/auto-web-rclone-rclone-7717.md) | backend: Add Apple iCloud Drive backend |
| rclone/rclone | [#8292](prs/auto-web-rclone-rclone-8292.md) | Add FileLu cloud storage backend |
| rclone/rclone | [#8886](prs/auto-web-rclone-rclone-8886.md) | backend: Add Huawei Drive support |
| rclone/rclone | [#9234](prs/auto-web-rclone-rclone-9234.md) | iclouddrive: add iCloud Photos support and SRP authenticatio |
| redpanda-data/redpanda | [#16684](prs/auto-web-redpanda-data-redpanda-16684.md) | archival: Add archiver_service |
| redpanda-data/redpanda | [#18449](prs/auto-web-redpanda-data-redpanda-18449.md) | Protobuf to Arrow converter |
| redpanda-data/redpanda | [#27039](prs/auto-web-redpanda-data-redpanda-27039.md) | cluster_link: admin api definition |
| redpanda-data/redpanda | [#28351](prs/auto-web-redpanda-data-redpanda-28351.md) | lsm: introduce a seastar native LSM database based on LevelD |
| reduxjs/redux-toolkit | [#4127](prs/auto-web-reduxjs-redux-toolkit-4127.md) | Migrate type tests to Vitest |
| reduxjs/redux-toolkit | [#4393](prs/auto-web-reduxjs-redux-toolkit-4393.md) | [API Concept] - Infinite Query API |
| reduxjs/redux-toolkit | [#4686](prs/auto-web-reduxjs-redux-toolkit-4686.md) | Update @testing-library/react from 13.3.0 to 16.0.1; Fixes # |
| reduxjs/redux-toolkit | [#4738](prs/auto-web-reduxjs-redux-toolkit-4738.md) | RTKQ Infinite Query integration |
| redwoodjs/redwood | [#10031](prs/auto-web-redwoodjs-redwood-10031.md) | feat(rsc-streaming): Integrating RSC builds with Streaming a |
| redwoodjs/redwood | [#11238](prs/auto-web-redwoodjs-redwood-11238.md) | Adds background job scheduling and execution |
| redwoodjs/redwood | [#9848](prs/auto-web-redwoodjs-redwood-9848.md) | Detect/resolve ambiguous script names |
| redwoodjs/redwood | [#9883](prs/auto-web-redwoodjs-redwood-9883.md) | feat(middleware): Add support for Middleware to SSR-Streamin |
| remix-run/react-router | [#11380](prs/auto-web-remix-run-react-router-11380.md) | Initial Migration |
| rerun-io/rerun | [#10126](prs/auto-web-rerun-io-rerun-10126.md) | New `VideoStream` archetype for loose video samples |
| rerun-io/rerun | [#6561](prs/auto-web-rerun-io-rerun-6561.md) | Map View and `GeoPoints` archetype |
| rerun-io/rerun | [#7500](prs/auto-web-rerun-io-rerun-7500.md) | Implement graph components and archetypes |
| rerun-io/rerun | [#8347](prs/auto-web-rerun-io-rerun-8347.md) | Encode `LogMsg` using protobuf |
| rolldown/rolldown | [#6486](prs/auto-web-rolldown-rolldown-6486.md) | feat(rolldown): support `output.clearDir` to clean up `dir`  |
| rolldown/rolldown | [#6873](prs/auto-web-rolldown-rolldown-6873.md) | feat: support vite-style tsconfig resolution |
| rolldown/rolldown | [#7351](prs/auto-web-rolldown-rolldown-7351.md) | chore(test): setup browser-based e2e test for `test-dev-serv |
| rolldown/rolldown | [#7486](prs/auto-web-rolldown-rolldown-7486.md) | feat: optimize dynamic entry facade chunks by merging with c |
| rook/rook | [#14489](prs/auto-web-rook-rook-14489.md) | csi: add csi-operator operator config cr |
| rook/rook | [#14701](prs/auto-web-rook-rook-14701.md) | rbdmirror: enable rbd rados namespace mirroring |
| rook/rook | [#16040](prs/auto-web-rook-rook-16040.md) | csi: automate CSI cephx key rotation |
| rook/rook | [#16689](prs/auto-web-rook-rook-16689.md) | nvmeof: add nvme-of gateway crd support |
| ruby/ruby | [#13074](prs/auto-web-ruby-ruby-13074.md) | Implement Set as a core class |
| ruby/ruby | [#14999](prs/auto-web-ruby-ruby-14999.md) | ZJIT: Add Iongraph compatibility |
| ruby/ruby | [#15359](prs/auto-web-ruby-ruby-15359.md) | ZJIT: Create HIR effect system |
| ruby/ruby | [#9777](prs/auto-web-ruby-ruby-9777.md) | Add Launchable into CI |
| run-llama/llama_index | [#13127](prs/auto-web-run-llama-llama_index-13127.md) | SecGPT - LlamaIndex Integration |
| run-llama/llama_index | [#16161](prs/auto-web-run-llama-llama_index-16161.md) | Oraclevs integration |
| run-llama/llama_index | [#17006](prs/auto-web-run-llama-llama_index-17006.md) | [Feature] Checkpointing with Workflows |
| run-llama/llama_index | [#20640](prs/auto-web-run-llama-llama_index-20640.md) | Support basic operations for multimodal types |
| rust-lang/cargo | [#13709](prs/auto-web-rust-lang-cargo-13709.md) | feat: implement RFC 3553 to add SBOM support |
| rust-lang/cargo | [#14615](prs/auto-web-rust-lang-cargo-14615.md) | Add terminal integration via ANSI OSC 9;4 sequences |
| rust-lang/rfcs | [#3668](prs/auto-web-rust-lang-rfcs-3668.md) | Async closures |
| rust-lang/rfcs | [#3681](prs/auto-web-rust-lang-rfcs-3681.md) | [RFC] Default field values |
| rust-lang/rfcs | [#3923](prs/auto-web-rust-lang-rfcs-3923.md) | Cargo RFC for min publish age |
| rust-lang/rfcs | [#3931](prs/auto-web-rust-lang-rfcs-3931.md) | Rust Foundation Maintainer Fund |
| rust-lang/rust | [#137944](prs/auto-web-rust-lang-rust-137944.md) | Sized Hierarchy: Part I |
| rust-lang/rust | [#43076](prs/auto-web-rust-lang-rust-43076.md) | Generator support |
| rust-lang/rust | [#49878](prs/auto-web-rust-lang-rust-49878.md) | libcore: Add VaList and variadic arg handling intrinsics |
| rust-lang/rust | [#69864](prs/auto-web-rust-lang-rust-69864.md) | unix: Extend UnixStream and UnixDatagram to send and receive |
| rust-lang/rust | [#90630](prs/auto-web-rust-lang-rust-90630.md) | Create real parser for search queries |
| rust-lang/rust-clippy | [#12239](prs/auto-web-rust-lang-rust-clippy-12239.md) | Add `missing_transmute_annotations` lint |
| rust-lang/rust-clippy | [#15215](prs/auto-web-rust-lang-rust-clippy-15215.md) | New lint: `decimal_bitwise_operands` |
| rust-lang/rust-clippy | [#16244](prs/auto-web-rust-lang-rust-clippy-16244.md) | Add unused_async_trait_impl lint |
| rust-lang/rust-clippy | [#16250](prs/auto-web-rust-lang-rust-clippy-16250.md) | Add new `duration_suboptimal_units` lint |
| rust-lang/rustfmt | [#6066](prs/auto-web-rust-lang-rustfmt-6066.md) | feat: use `semver` to match required version |
| rust-lang/rustfmt | [#6212](prs/auto-web-rust-lang-rustfmt-6212.md) | Impl rewrite_result for ast nodes in items.rs |
| rust-lang/rustfmt | [#6247](prs/auto-web-rust-lang-rustfmt-6247.md) | implement Style Edition support |
| rust-lang/rustfmt | [#6275](prs/auto-web-rust-lang-rustfmt-6275.md) | `compile_rustfmt` rewrite |
| scikit-learn/scikit-learn | [#31937](prs/auto-web-scikit-learn-scikit-learn-31937.md) | ENH: Display the number and names of output features |
| scikit-learn/scikit-learn | [#32644](prs/auto-web-scikit-learn-scikit-learn-32644.md) | FEA Add array API support for LogisticRegression with LBFGS |
| scrapy/scrapy | [#6608](prs/auto-web-scrapy-scrapy-6608.md) | Flexible severity of logging level when items are dropped |
| scrapy/scrapy | [#6729](prs/auto-web-scrapy-scrapy-6729.md) | Minimal asynchronous start requests |
| scrapy/scrapy | [#7007](prs/auto-web-scrapy-scrapy-7007.md) | Optimise `SitemapSpider` memory usage |
| scrapy/scrapy | [#7283](prs/auto-web-scrapy-scrapy-7283.md) | Added DOWNLOAD_BIND_ADDRESS setting for download handlers |
| scylladb/scylladb | [#16723](prs/auto-web-scylladb-scylladb-16723.md) | tablets: alter keyspace |
| scylladb/scylladb | [#22906](prs/auto-web-scylladb-scylladb-22906.md) | Co-locate tablets of different tables |
| scylladb/scylladb | [#23760](prs/auto-web-scylladb-scylladb-23760.md) | Introduce view building coordinator |
| scylladb/scylladb | [#28763](prs/auto-web-scylladb-scylladb-28763.md) | Tablet-aware restore |
| sequelize/sequelize | [#17198](prs/auto-web-sequelize-sequelize-17198.md) | feat(mariadb)!: move mariadb to the `@sequelize/mariadb` pac |
| sequelize/sequelize | [#18050](prs/auto-web-sequelize-sequelize-18050.md) | feat(oracle): add oracle support |
| sequelize/sequelize | [#18051](prs/auto-web-sequelize-sequelize-18051.md) | feat(core): Convert query.js to typescript. Implemented Cach |
| sequelize/sequelize | [#18193](prs/auto-web-sequelize-sequelize-18193.md) | feat(cli): add migration generate, run, status & undo |
| serde-rs/serde | [#2709](prs/auto-web-serde-rs-serde-2709.md) | Implement Ser+De for Saturating<T> |
| serde-rs/serde | [#2816](prs/auto-web-serde-rs-serde-2816.md) | Implement serialize/deserialize for core::net instead of std |
| serde-rs/serde | [#2879](prs/auto-web-serde-rs-serde-2879.md) | add `#[allow(deprecated)]` to derive implementations |
| serde-rs/serde | [#2980](prs/auto-web-serde-rs-serde-2980.md) | Use differently named __private module per patch release |
| servo/servo | [#31417](prs/auto-web-servo-servo-31417.md) | Initial internal support for multiple webviews |
| servo/servo | [#33044](prs/auto-web-servo-servo-33044.md) | Initial IndexedDB Support |
| servo/servo | [#40365](prs/auto-web-servo-servo-40365.md) | Add basic support for handling module scripts in workers |
| servo/servo | [#41508](prs/auto-web-servo-servo-41508.md) | Indexeddb: transaction lifecycle |
| sgl-project/sglang | [#12263](prs/auto-web-sgl-project-sglang-12263.md) | feat: support EPD disaggregation |
| sgl-project/sglang | [#19746](prs/auto-web-sgl-project-sglang-19746.md) | [P/D disagg] - support decode side radix cache |
| sgl-project/sglang | [#21569](prs/auto-web-sgl-project-sglang-21569.md) | Upgrade transformers to 5.5.3 and refactor hf_transformers_u |
| sgl-project/sglang | [#4848](prs/auto-web-sgl-project-sglang-4848.md) | Support server based rollout in Verlengine |
| sharkdp/bat | [#3432](prs/auto-web-sharkdp-bat-3432.md) | make --help and -h use pager |
| sharkdp/bat | [#3438](prs/auto-web-sharkdp-bat-3438.md) | feat: make output pipeable with `-n`, non-auto styles |
| sharkdp/bat | [#3517](prs/auto-web-sharkdp-bat-3517.md) | Improve native man pages and command help syntax highlightin |
| sharkdp/bat | [#3576](prs/auto-web-sharkdp-bat-3576.md) | feat: Map BUILD to Python (Starlark) for Bazel (fixes #3575) |
| siderolabs/talos | [#12406](prs/auto-web-siderolabs-talos-12406.md) | feat: rootless imager |
| siderolabs/talos | [#12519](prs/auto-web-siderolabs-talos-12519.md) | feat(imager): populate filesystems with root owned files. |
| siderolabs/talos | [#8901](prs/auto-web-siderolabs-talos-8901.md) | feat: support volume configuration, provisioning, etc. |
| siderolabs/talos | [#9617](prs/auto-web-siderolabs-talos-9617.md) | feat: machined: initial SELinux bring-up |
| sigstore/cosign | [#3844](prs/auto-web-sigstore-cosign-3844.md) | Upgrade to TUF v2 client |
| sigstore/cosign | [#3889](prs/auto-web-sigstore-cosign-3889.md) | Add support for new bundle specification for attesting/verif |
| sigstore/cosign | [#4618](prs/auto-web-sigstore-cosign-4618.md) | Sign exclusively via sigstore-go |
| slint-ui/slint | [#10117](prs/auto-web-slint-ui-slint-10117.md) | Documentation for Mobile Development |
| slint-ui/slint | [#10857](prs/auto-web-slint-ui-slint-10857.md) | Respect the locale's decimal separator in string to float an |
| slint-ui/slint | [#11052](prs/auto-web-slint-ui-slint-11052.md) | safe-ui: implement interrupt-safe FFI callback queue |
| slint-ui/slint | [#11487](prs/auto-web-slint-ui-slint-11487.md) | New drag-and-drop type system |
| solidjs/solid | [#2143](prs/auto-web-solidjs-solid-2143.md) | Point API references to new docs entries |
| solidjs/solid | [#2269](prs/auto-web-solidjs-solid-2269.md) | update dom-expressions, solid-js/web, solid-js/html, solid-j |
| solidjs/solid | [#2533](prs/auto-web-solidjs-solid-2533.md) | Refactor: Rename `loading` to `_loading` and optimize `creat |
| solidjs/solid | [#2591](prs/auto-web-solidjs-solid-2591.md) | import manifest instead of reading it |
| spf13/cobra | [#2173](prs/auto-web-spf13-cobra-2173.md) | Make detection for test-binary more universal |
| spf13/cobra | [#2231](prs/auto-web-spf13-cobra-2231.md) | feat: add CompletionWithDesc helper |
| spf13/cobra | [#2238](prs/auto-web-spf13-cobra-2238.md) | The default ShellCompDirective can be customized for a comma |
| spf13/cobra | [#2356](prs/auto-web-spf13-cobra-2356.md) | fix: prevent completions from mutating os.Args via append si |
| spring-projects/spring-boot | [#49285](prs/auto-web-spring-projects-spring-boot-49285.md) | Add more styling support to the Logback and Log4j2 color con |
| spring-projects/spring-boot | [#49571](prs/auto-web-spring-projects-spring-boot-49571.md) | Enable ansi support by default on Windows 11+ |
| spring-projects/spring-boot | [#49839](prs/auto-web-spring-projects-spring-boot-49839.md) | Document the need for Liquibase and Flyway starters |
| spring-projects/spring-boot | [#50095](prs/auto-web-spring-projects-spring-boot-50095.md) | EndpointRequest links matcher unnecessarily matches HTTP met |
| spring-projects/spring-framework | [#33705](prs/auto-web-spring-projects-spring-framework-33705.md) | Fix `PathMatchingResourcePatternResolver` manifest classpath |
| spring-projects/spring-framework | [#35055](prs/auto-web-spring-projects-spring-framework-35055.md) | Document intention of `toString()` in `HandlerMethod` |
| spring-projects/spring-framework | [#36600](prs/auto-web-spring-projects-spring-framework-36600.md) | Document that `spring.profiles.active` is ignored by `@Activ |
| spring-projects/spring-framework | [#36641](prs/auto-web-spring-projects-spring-framework-36641.md) | Avoid redundant URI object creation in WebClientUtils |
| sqlalchemy/sqlalchemy | [#10831](prs/auto-web-sqlalchemy-sqlalchemy-10831.md) | Documenting multiprocessing and events |
| sqlalchemy/sqlalchemy | [#11095](prs/auto-web-sqlalchemy-sqlalchemy-11095.md) | session.begin()'s contextmanager should return type Self |
| sqlalchemy/sqlalchemy | [#11555](prs/auto-web-sqlalchemy-sqlalchemy-11555.md) | Added valid types to server_onupdate |
| sqlalchemy/sqlalchemy | [#12200](prs/auto-web-sqlalchemy-sqlalchemy-12200.md) | before_mapper_configured event doc fixes |
| stanfordnlp/dspy | [#1594](prs/auto-web-stanfordnlp-dspy-1594.md) | Refactor finetuning implementation to be 2.5 compatible |
| stanfordnlp/dspy | [#1698](prs/auto-web-stanfordnlp-dspy-1698.md) | Dev finetune update |
| stanfordnlp/dspy | [#8775](prs/auto-web-stanfordnlp-dspy-8775.md) | docs: Add comprehensive instruction_proposer documentation a |
| stanfordnlp/dspy | [#8928](prs/auto-web-stanfordnlp-dspy-8928.md) | feat(gepa): add tool description optimization for multi-agen |
| streamlit/streamlit | [#11532](prs/auto-web-streamlit-streamlit-11532.md) | Added st.pdf |
| streamlit/streamlit | [#14972](prs/auto-web-streamlit-streamlit-14972.md) | [feature] Add custom script error handling via `st.App` |
| streamlit/streamlit | [#8915](prs/auto-web-streamlit-streamlit-8915.md) | Add feedback widget |
| streamlit/streamlit | [#9404](prs/auto-web-streamlit-streamlit-9404.md) | st.experimental_audio_input |
| surrealdb/surrealdb | [#3988](prs/auto-web-surrealdb-surrealdb-3988.md) | Consolidate authentication methods |
| surrealdb/surrealdb | [#5701](prs/auto-web-surrealdb-surrealdb-5701.md) | Files |
| surrealdb/surrealdb | [#6079](prs/auto-web-surrealdb-surrealdb-6079.md) | Invert expression value relation and move ast types out of v |
| surrealdb/surrealdb | [#6402](prs/auto-web-surrealdb-surrealdb-6402.md) | Use `surrealdb_types::*` in SDK and as core's public interfa |
| sveltejs/svelte | [#18042](prs/auto-web-sveltejs-svelte-18042.md) | feat: custom renderers API |
| swiftlang/swift | [#71688](prs/auto-web-swiftlang-swift-71688.md) | [stdlib] Start adopting noncopyable generics in the stdlib |
| swiftlang/swift | [#72161](prs/auto-web-swiftlang-swift-72161.md) | [android] add a module map for Android NDK |
| swiftlang/swift | [#80941](prs/auto-web-swiftlang-swift-80941.md) | [SE-0489] Better `debugDescription` for `EncodingError` and  |
| symfony/symfony | [#58095](prs/auto-web-symfony-symfony-58095.md) | [Security] Implement stateless headers/cookies-based CSRF pr |
| symfony/symfony | [#60212](prs/auto-web-symfony-symfony-60212.md) | [Form] Add `FormFlow` for multistep forms management |
| sympy/sympy | [#26412](prs/auto-web-sympy-sympy-26412.md) | Implement the Coulomb kinetic friction actuator |
| sympy/sympy | [#27423](prs/auto-web-sympy-sympy-27423.md) | Add Fraction-Free LU Decomposition for DomainMatrix |
| sympy/sympy | [#28109](prs/auto-web-sympy-sympy-28109.md) | [Ring Series]: New series module supporting truncated power  |
| sympy/sympy | [#28265](prs/auto-web-sympy-sympy-28265.md) | Simplification and extension of stability inequalities to do |
| TanStack/router | [#1907](prs/auto-web-tanstack-router-1907.md) | fix(router): context issues |
| TanStack/router | [#5475](prs/auto-web-tanstack-router-5475.md) | fix: not all pages are pre-rendered |
| TanStack/router | [#5558](prs/auto-web-tanstack-router-5558.md) | test(solid-start): basic-auth e2e suite and example |
| TanStack/router | [#6866](prs/auto-web-tanstack-router-6866.md) | feat: add @tanstack/intent AI agent skills for Router and St |
| tauri-apps/tauri | [#12668](prs/auto-web-tauri-apps-tauri-12668.md) | feat: introduce `App::run_return` |
| tauri-apps/tauri | [#14523](prs/auto-web-tauri-apps-tauri-14523.md) | Fix(macos/ios): Add handler for web content process terminat |
| tauri-apps/tauri | [#14959](prs/auto-web-tauri-apps-tauri-14959.md) | refactor: replace `kuchikiki` with `dom_query` |
| tauri-apps/tauri | [#9994](prs/auto-web-tauri-apps-tauri-9994.md) | feat!(nsis): add an option to customize start menu folder |
| tektoncd/pipeline | [#7714](prs/auto-web-tektoncd-pipeline-7714.md) | Surface artifacts through termination message |
| tektoncd/pipeline | [#7845](prs/auto-web-tektoncd-pipeline-7845.md) | TEP-0154: Enable concise resolver syntax - stage 1 |
| tektoncd/pipeline | [#8636](prs/auto-web-tektoncd-pipeline-8636.md) | feat: override task timeouts in pipelineruns |
| tektoncd/pipeline | [#9043](prs/auto-web-tektoncd-pipeline-9043.md) | feat(metrics): Migrate from OpenCensus to OpenTelemetry |
| temporalio/temporal | [#8223](prs/auto-web-temporalio-temporal-8223.md) | Degraded workflow visibility |
| temporalio/temporal | [#8563](prs/auto-web-temporalio-temporal-8563.md) | PollComponent and PollActivityExecution |
| temporalio/temporal | [#8662](prs/auto-web-temporalio-temporal-8662.md) | Add implementation of CHASM List/Count Runs |
| temporalio/temporal | [#9614](prs/auto-web-temporalio-temporal-9614.md) | Callback for workflow update support |
| thanos-io/thanos | [#7353](prs/auto-web-thanos-io-thanos-7353.md) | Receiver: cache matchers for series calls |
| thanos-io/thanos | [#7890](prs/auto-web-thanos-io-thanos-7890.md) | query, rule: make endpoint discovery dynamically reloadable |
| thanos-io/thanos | [#7996](prs/auto-web-thanos-io-thanos-7996.md) | [FEATURE] adding otlp endpoint |
| thanos-io/thanos | [#8594](prs/auto-web-thanos-io-thanos-8594.md) | Support per endpoint TLS configuration |
| tiangolo/sqlmodel | [#1289](prs/auto-web-tiangolo-sqlmodel-1289.md) | ⬆️ Add support for Python 3.13 |
| tiangolo/sqlmodel | [#1577](prs/auto-web-tiangolo-sqlmodel-1577.md) | 🐛 Fix `alias` support for Pydantic v2 |
| tiangolo/sqlmodel | [#1806](prs/auto-web-tiangolo-sqlmodel-1806.md) | 👷 Replace `mypy` with `ty` in precommit |
| tiangolo/sqlmodel | [#983](prs/auto-web-tiangolo-sqlmodel-983.md) | ✨ Add support for cascade delete relationships: `cascade_del |
| tikv/tikv | [#17625](prs/auto-web-tikv-tikv-17625.md) | raftstore: `campaign` newly created regions in time after `S |
| tikv/tikv | [#18173](prs/auto-web-tikv-tikv-18173.md) | follower read cache |
| tikv/tikv | [#18724](prs/auto-web-tikv-tikv-18724.md) | GC: Move gc compaction to gc worker module |
| tikv/tikv | [#19315](prs/auto-web-tikv-tikv-19315.md) | BR: add new storage type using google offical rust package |
| tokio-rs/axum | [#2507](prs/auto-web-tokio-rs-axum-2507.md) | Add Scheme extractor |
| tokio-rs/axum | [#2654](prs/auto-web-tokio-rs-axum-2654.md) | Add multipart/form-data response builders to axum-extra |
| tokio-rs/axum | [#3047](prs/auto-web-tokio-rs-axum-3047.md) | Add an encapsulated file stream in axum-extra to make it mor |
| tokio-rs/axum | [#3288](prs/auto-web-tokio-rs-axum-3288.md) | Add macro to compile time check if a path is valid |
| tokio-rs/tracing | [#3000](prs/auto-web-tokio-rs-tracing-3000.md) | appender: Add fallback to file creation date |
| tokio-rs/tracing | [#3033](prs/auto-web-tokio-rs-tracing-3033.md) | subscriber: update matchers to 0.2 |
| tokio-rs/tracing | [#3069](prs/auto-web-tokio-rs-tracing-3069.md) | v0.1.x: clean up warnings |
| tokio-rs/tracing | [#3243](prs/auto-web-tokio-rs-tracing-3243.md) | subscriber: use state machine to parse `EnvFilter` directive |
| tower-rs/tower | [#777](prs/auto-web-tower-rs-tower-777.md) | Add `BoxCloneSyncService` |
| tower-rs/tower | [#805](prs/auto-web-tower-rs-tower-805.md) | chore: Replace type related to future with standard library |
| tower-rs/tower | [#810](prs/auto-web-tower-rs-tower-810.md) | `no-std` compatibility for underlying traits |
| tower-rs/tower | [#828](prs/auto-web-tower-rs-tower-828.md) | fix: use minimal tokio features in `make` and `reconnect` fe |
| traefik/traefik | [#11330](prs/auto-web-traefik-traefik-11330.md) | New Routing Reference Documentation |
| traefik/traefik | [#12130](prs/auto-web-traefik-traefik-12130.md) | Multi-layer routing |
| traefik/traefik | [#12318](prs/auto-web-traefik-traefik-12318.md) | NGINX Ingress Controller to Traefik Migration Guide |
| traefik/traefik | [#12360](prs/auto-web-traefik-traefik-12360.md) | Reject suspicious encoded characters |
| trinodb/trino | [#21265](prs/auto-web-trinodb-trino-21265.md) | feat: add OpenLineage EventListener plugin |
| trinodb/trino | [#21463](prs/auto-web-trinodb-trino-21463.md) | Add support for storing metadata to metastore in Delta Lake |
| trinodb/trino | [#24117](prs/auto-web-trinodb-trino-24117.md) | Add support for fetching Redshift query results using Redshi |
| trinodb/trino | [#28381](prs/auto-web-trinodb-trino-28381.md) | Read metadata and protocol information from Delta checksum f |
| triton-lang/triton | [#5018](prs/auto-web-triton-lang-triton-5018.md) | [AMD] Add a block ping-poing scheduling pass |
| triton-lang/triton | [#5419](prs/auto-web-triton-lang-triton-5419.md) | [Backend] Implement layout conversion within warps with shuf |
| triton-lang/triton | [#6788](prs/auto-web-triton-lang-triton-6788.md) | Use variadic argument pre-compiled cuda launcher |
| triton-lang/triton | [#7657](prs/auto-web-triton-lang-triton-7657.md) | [Gluon][Tutorials] Add Tutorials |
| trpc/trpc | [#6134](prs/auto-web-trpc-trpc-6134.md) | feat(tanstack-react-query): introduce `queryOptions` API in  |
| trpc/trpc | [#6223](prs/auto-web-trpc-trpc-6223.md) | chore(client): refactor & undeprecate `wsLink` |
| trpc/trpc | [#7231](prs/auto-web-trpc-trpc-7231.md) | feat: Support OpenAPI json generation for any tRPC appRouter |
| trpc/trpc | [#7252](prs/auto-web-trpc-trpc-7252.md) | feat: Tanstack Intent Skills |
| typeorm/typeorm | [#11318](prs/auto-web-typeorm-typeorm-11318.md) | feat(postgres): add support for PostgreSQL indices |
| typeorm/typeorm | [#11332](prs/auto-web-typeorm-typeorm-11332.md) | feat: add new undefined and null behavior flags |
| typeorm/typeorm | [#11432](prs/auto-web-typeorm-typeorm-11432.md) | feat: add tagged template for executing raw SQL queries |
| typeorm/typeorm | [#11798](prs/auto-web-typeorm-typeorm-11798.md) | feat(mysql): update query types to include named parameters |
| uber-go/zap | [#1408](prs/auto-web-uber-go-zap-1408.md) | zapslog: fix all with slogtest, support inline group, ignore |
| uber-go/zap | [#1460](prs/auto-web-uber-go-zap-1460.md) | Add `func DictObject` |
| uber-go/zap | [#1501](prs/auto-web-uber-go-zap-1501.md) | Prevent zap.Object from panicing on nils |
| uber-go/zap | [#1519](prs/auto-web-uber-go-zap-1519.md) | Update lazy logger not to materialize unless it's being writ |
| ultralytics/ultralytics | [#10165](prs/auto-web-ultralytics-ultralytics-10165.md) | new TensorRT INT8 export feature |
| ultralytics/ultralytics | [#13113](prs/auto-web-ultralytics-ultralytics-13113.md) | official YOLOv10 support |
| ultralytics/ultralytics | [#18484](prs/auto-web-ultralytics-ultralytics-18484.md) | NMS Export for Detect, Segment, Pose and OBB YOLO models |
| ultralytics/ultralytics | [#22802](prs/auto-web-ultralytics-ultralytics-22802.md) | add Axelera export for YOLO on Metis AIPU |
| urfave/cli | [#1998](prs/auto-web-urfave-cli-1998.md) | Improve the command for printing completion scripts |
| urfave/cli | [#2043](prs/auto-web-urfave-cli-2043.md) | while print flag , the placeholder if need but not set. |
| urfave/cli | [#2094](prs/auto-web-urfave-cli-2094.md) | feat!: add more integers and unsigned integers |
| uutils/coreutils | [#10773](prs/auto-web-uutils-coreutils-10773.md) | coreutils: Protect against env -a for security |
| uutils/coreutils | [#5801](prs/auto-web-uutils-coreutils-5801.md) | env: support string args by '-S', '-vS' or '--split-strings' |
| uutils/coreutils | [#8833](prs/auto-web-uutils-coreutils-8833.md) | Improve sort buffer sizing heuristics and honor explicit --b |
| uutils/coreutils | [#9567](prs/auto-web-uutils-coreutils-9567.md) | build-gnu.sh: Use MULTICALL=y and skip not used utils for fa |
| vectordotdev/vector | [#20859](prs/auto-web-vectordotdev-vector-20859.md) | feat(codecs): Implement chunked GELF decoding |
| vectordotdev/vector | [#21248](prs/auto-web-vectordotdev-vector-21248.md) | feat(postgres sink): Add postgres sink |
| vectordotdev/vector | [#24840](prs/auto-web-vectordotdev-vector-24840.md) | feat(sinks): add new databricks_zerobus for Databricks inges |
| vectordotdev/vector | [#25035](prs/auto-web-vectordotdev-vector-25035.md) | enhancement(transforms): dynamic rate for sample |
| vercel/turborepo | [#11130](prs/auto-web-vercel-turborepo-11130.md) | feat: Add experimentalObservability with an OTel backend |
| vercel/turborepo | [#7098](prs/auto-web-vercel-turborepo-7098.md) | Examples tests revamp. |
| vercel/turborepo | [#7322](prs/auto-web-vercel-turborepo-7322.md) | Improve daemon startup times |
| vercel/turborepo | [#9249](prs/auto-web-vercel-turborepo-9249.md) | handle VERCEL_ARTIFACTS_* env vars override |
| VictoriaMetrics/VictoriaMetrics | [#10046](prs/auto-web-victoriametrics-victoriametrics-10046.md) | app/vmalert: add `group_limit` and `page_num` for pagination |
| VictoriaMetrics/VictoriaMetrics | [#7863](prs/auto-web-victoriametrics-victoriametrics-7863.md) | issue-7717: implement migration from mimir object storage |
| VictoriaMetrics/VictoriaMetrics | [#8134](prs/auto-web-victoriametrics-victoriametrics-8134.md) | lib/storage: implement partition index |
| VictoriaMetrics/VictoriaMetrics | [#9487](prs/auto-web-victoriametrics-victoriametrics-9487.md) | cluster: add support of ingesting metadata |
| vitejs/vite | [#16471](prs/auto-web-vitejs-vite-16471.md) | feat: v6 - Environment API |
| vitessio/vitess | [#15988](prs/auto-web-vitessio-vitess-15988.md) | Tablet throttler: multi-metric support |
| vitessio/vitess | [#15992](prs/auto-web-vitessio-vitess-15992.md) | add support for vtgate traffic mirroring (queryserving) |
| vitessio/vitess | [#16295](prs/auto-web-vitessio-vitess-16295.md) | adding new mysql shell backup engine |
| vitessio/vitess | [#17763](prs/auto-web-vitessio-vitess-17763.md) | Add semi-sync monitor to unblock primaries blocked on semi-s |
| vitest-dev/vitest | [#10113](prs/auto-web-vitest-dev-vitest-10113.md) | feat(benchmark)!: rewrite the public API |
| vitest-dev/vitest | [#7509](prs/auto-web-vitest-dev-vitest-7509.md) | feat: support rolldown-vite |
| vitest-dev/vitest | [#8041](prs/auto-web-vitest-dev-vitest-8041.md) | feat(browser): introduce `toMatchScreenshot` for Visual Regr |
| vitest-dev/vitest | [#8409](prs/auto-web-vitest-dev-vitest-8409.md) | docs: add comprehensive Component Testing guide |
| vllm-project/vllm | [#12388](prs/auto-web-vllm-project-vllm-12388.md) | [V1][Core] Support for Structured Outputs |
| vllm-project/vllm | [#20059](prs/auto-web-vllm-project-vllm-20059.md) | [Core] Allow full cudagraph with separate attention routines |
| vllm-project/vllm | [#20859](prs/auto-web-vllm-project-vllm-20859.md) | [Feature] limit thinking tokens (hard limit) |
| vllm-project/vllm | [#5649](prs/auto-web-vllm-project-vllm-5649.md) | [Feature] OpenAI-Compatible Tools API + Streaming for Hermes |
| vuejs/core | [#5912](prs/auto-web-vuejs-core-5912.md) | feat(reactivity): more efficient reactivity system |
| vuejs/pinia | [#2604](prs/auto-web-vuejs-pinia-2604.md) | fix(types): fix storeToRefs state return type |
| vuejs/pinia | [#2847](prs/auto-web-vuejs-pinia-2847.md) | feat: writable `computed`s to be picked up by `mapWritableSt |
| vuejs/pinia | [#2983](prs/auto-web-vuejs-pinia-2983.md) | feat(warn): detect global context on the server side |
| vuejs/pinia | [#3035](prs/auto-web-vuejs-pinia-3035.md) | fix(nuxt): resolve auto-imports in layers |
| wandb/wandb | [#10136](prs/auto-web-wandb-wandb-10136.md) | chore(artifacts): compute hash of multipart in parallel |
| wandb/wandb | [#10571](prs/auto-web-wandb-wandb-10571.md) | chore: wandb leet: TUI scaffold & CLI subcommand |
| wandb/wandb | [#8488](prs/auto-web-wandb-wandb-8488.md) | chore: update min version of sentry-sdk |
| wandb/wandb | [#8896](prs/auto-web-wandb-wandb-8896.md) | feat(sdk): add methods to create, read, and delete automatio |
| weaviate/weaviate | [#11155](prs/auto-web-weaviate-weaviate-11155.md) | feat: async replication scheduler |
| weaviate/weaviate | [#11327](prs/auto-web-weaviate-weaviate-11327.md) | [Reindex v1.38 Preview] Backup × runtime-reindex fixes |
| weaviate/weaviate | [#6012](prs/auto-web-weaviate-weaviate-6012.md) | Dynamic backup locations |
| weaviate/weaviate | [#9223](prs/auto-web-weaviate-weaviate-9223.md) | Beta Server-side Batching |
| WebKit/WebKit | [#48322](prs/auto-web-webkit-webkit-48322.md) | Implement speculation rules - same origin conservative prefe |
| WebKit/WebKit | [#50706](prs/auto-web-webkit-webkit-50706.md) | Add support for loading USDs in WCP and rendering them in GP |
| WebKit/WebKit | [#57827](prs/auto-web-webkit-webkit-57827.md) | [JSC] Rewrite module loader |
| webpack/webpack | [#18772](prs/auto-web-webpack-webpack-18772.md) | feat: add new optimization.entryIife config |
| webpack/webpack | [#20907](prs/auto-web-webpack-webpack-20907.md) | feat: support cross-module pure detection in inner graph |
| webpack/webpack | [#20964](prs/auto-web-webpack-webpack-20964.md) | feat: basic `typescript` support using Node.js typescript AP |
| webpack/webpack | [#21018](prs/auto-web-webpack-webpack-21018.md) | fix: include referenced module's hash in HTML source/inline- |
| wez/wezterm | [#5416](prs/auto-web-wez-wezterm-5416.md) | Add arrows support for search field |
| wez/wezterm | [#6290](prs/auto-web-wez-wezterm-6290.md) | add cellwidths option #6289 |
| wez/wezterm | [#6602](prs/auto-web-wez-wezterm-6602.md) | feat: Tmux control mode |
| wez/wezterm | [#6800](prs/auto-web-wez-wezterm-6800.md) | docs: hyperlinks: integration example |
| yarnpkg/berry | [#6688](prs/auto-web-yarnpkg-berry-6688.md) | Improve pnp loader speed and memory: jszip implementation |
| yarnpkg/berry | [#6750](prs/auto-web-yarnpkg-berry-6750.md) | feat(plugin-npm): add npm provenance support |
| yarnpkg/berry | [#6992](prs/auto-web-yarnpkg-berry-6992.md) | feat(why): allow specifying a version or range |
| yarnpkg/berry | [#7089](prs/auto-web-yarnpkg-berry-7089.md) | Makes `enableScripts: false` the default |
| yewstack/yew | [#4033](prs/auto-web-yewstack-yew-4033.md) | fix: yield when 16ms has passed and no dom mutating tasks ar |
| yewstack/yew | [#4046](prs/auto-web-yewstack-yew-4046.md) | feat: add SSR e2e hydration tests for simple_ssr and ssr_rou |
| yewstack/yew | [#4099](prs/auto-web-yewstack-yew-4099.md) | fix: pair unkeyed children front-to-front during reconciliat |
| yewstack/yew | [#4113](prs/auto-web-yewstack-yew-4113.md) | feat: add actix support for yew-link |
| zed-industries/zed | [#13433](prs/auto-web-zed-industries-zed-13433.md) | Debugger implementation |
| zed-industries/zed | [#20400](prs/auto-web-zed-industries-zed-20400.md) | Windows: Add transparency effect |
| zed-industries/zed | [#26893](prs/auto-web-zed-industries-zed-26893.md) | editor: Add minimap |
| zellij-org/zellij | [#3242](prs/auto-web-zellij-org-zellij-3242.md) | Theme definition |
| zellij-org/zellij | [#3349](prs/auto-web-zellij-org-zellij-3349.md) | Switch from Wasmer to Wasmtime |
| zellij-org/zellij | [#4623](prs/auto-web-zellij-org-zellij-4623.md) | Fix partial sequences parsing |
| zellij-org/zellij | [#4768](prs/auto-web-zellij-org-zellij-4768.md) | [Windows port PR8] feature: add Windows support |
| zephyrproject-rtos/zephyr | [#77930](prs/auto-web-zephyrproject-rtos-zephyr-77930.md) | A new non volatile storage system |
| zephyrproject-rtos/zephyr | [#85508](prs/auto-web-zephyrproject-rtos-zephyr-85508.md) | STM32 EXTI Rework |
| zephyrproject-rtos/zephyr | [#89776](prs/auto-web-zephyrproject-rtos-zephyr-89776.md) | drivers: sdio: Support SDIO driver for STM32 |
| zephyrproject-rtos/zephyr | [#94085](prs/auto-web-zephyrproject-rtos-zephyr-94085.md) | usb: host: class: support for usb host video class |
| ziglang/zig | [#20271](prs/auto-web-ziglang-zig-20271.md) | ZON by MasonRemaley |
| ziglang/zig | [#20511](prs/auto-web-ziglang-zig-20511.md) | runtime page size detection + rework GeneralPurposeAllocator |
| ziglang/zig | [#23441](prs/auto-web-ziglang-zig-23441.md) | std.os.uefi.tables: ziggify boot and runtime services |

## Auto-collector batch (Bun `collect.ts`)

| Repo | PR | Title |
|------|----|-------|
| 2dust/v2rayN | [#7929](prs/auto-2dust-v2rayn-7929.md) | Multi profile |
| 2dust/v2rayN | [#8234](prs/auto-2dust-v2rayn-8234.md) | Cert Pinning |
| 2dust/v2rayN | [#8352](prs/auto-2dust-v2rayn-8352.md) | perf: Shadowsocks |
| 2dust/v2rayN | [#8659](prs/auto-2dust-v2rayn-8659.md) | Refactor profile item config |
| 2dust/v2rayN | [#9063](prs/auto-2dust-v2rayn-9063.md) | Add xray tun support |
| affaan-m/ECC | [#1367](prs/auto-affaan-m-ecc-1367.md) | feat(hooks,skills): add gateguard fact-forcing pre-action ga |
| affaan-m/ECC | [#744](prs/auto-affaan-m-ecc-744.md) | Add Turkish (tr) docs and update README |
| airbnb/javascript | [#2878](prs/auto-airbnb-javascript-2878.md) | remove object.entries dependency |
| anomalyco/opencode | [#10597](prs/auto-anomalyco-opencode-10597.md) | sqlite again |
| anomalyco/opencode | [#18186](prs/auto-anomalyco-opencode-18186.md) | anthropic legal requests |
| anomalyco/opencode | [#3924](prs/auto-anomalyco-opencode-3924.md) | feat: nix support for the nix folks |
| anomalyco/opencode | [#4773](prs/auto-anomalyco-opencode-4773.md) | Added: Ability to hide subagents from primary agents system  |
| anomalyco/opencode | [#8900](prs/auto-anomalyco-opencode-8900.md) | feat(opencode): add copilot specific provider to properly ha |
| ant-design/ant-design | [#48157](prs/auto-ant-design-ant-design-48157.md) | feat: progress add inside and bottom text position |
| ant-design/ant-design | [#50038](prs/auto-ant-design-ant-design-50038.md) | feat:🔥New Component: Splitter |
| ant-design/ant-design | [#55154](prs/auto-ant-design-ant-design-55154.md) | feat: ConfigProvider support unique Tooltip |
| ant-design/ant-design | [#57720](prs/auto-ant-design-ant-design-57720.md) | feat: add BorderBeam component |
| anthropics/claude-code | [#1](prs/auto-anthropics-claude-code-1.md) | Create SECURITY.md |
| apache/airflow | [#37948](prs/auto-apache-airflow-37948.md) | [AIP-49] OpenTelemetry Traces for Apache Airflow |
| apache/airflow | [#55068](prs/auto-apache-airflow-55068.md) | Re-enable start_from_trigger feature with rendering of templ |
| apache/airflow | [#56187](prs/auto-apache-airflow-56187.md) | Move the traces and metrics code under a common observabilit |
| apache/airflow | [#62343](prs/auto-apache-airflow-62343.md) | Add async connection testing via workers for security isolat |
| AUTOMATIC1111/stable-diffusion-webui | [#14588](prs/auto-automatic1111-stable-diffusion-webui-14588.md) | Feature: Extra Networks Tree View |
| AUTOMATIC1111/stable-diffusion-webui | [#14820](prs/auto-automatic1111-stable-diffusion-webui-14820.md) | Update to ROCm5.7 and PyTorch |
| AUTOMATIC1111/stable-diffusion-webui | [#15600](prs/auto-automatic1111-stable-diffusion-webui-15600.md) | Fix corrupt model initial load loop |
| AUTOMATIC1111/stable-diffusion-webui | [#16030](prs/auto-automatic1111-stable-diffusion-webui-16030.md) | Stable Diffusion 3 support |
| AUTOMATIC1111/stable-diffusion-webui | [#16054](prs/auto-automatic1111-stable-diffusion-webui-16054.md) | Fix sampler scheduler autocorrection warning |
| avelino/awesome-go | [#5838](prs/auto-avelino-awesome-go-5838.md) | add beep |
| axios/axios | [#6539](prs/auto-axios-axios-6539.md) | fix(sec): disregard protocol-relative URL to remediate SSRF |
| bevyengine/bevy | [#11426](prs/auto-bevyengine-bevy-11426.md) | Computed State & Sub States |
| bevyengine/bevy | [#18670](prs/auto-bevyengine-bevy-18670.md) | Remote entity reservation v9 |
| bevyengine/bevy | [#19451](prs/auto-bevyengine-bevy-19451.md) | Improved Entity Lifecycle: remove flushing, support manual s |
| bevyengine/bevy | [#20934](prs/auto-bevyengine-bevy-20934.md) | Store Resources as components on singleton entities |
| bitcoin/bitcoin | [#29415](prs/auto-bitcoin-bitcoin-29415.md) | Broadcast own transactions only via short-lived Tor or I2P c |
| bitcoin/bitcoin | [#30377](prs/auto-bitcoin-bitcoin-30377.md) | refactor: Replace ParseHex with consteval ""_hex literals |
| bitcoin/bitcoin | [#30595](prs/auto-bitcoin-bitcoin-30595.md) | kernel: Introduce C header API |
| bitcoin/bitcoin | [#31144](prs/auto-bitcoin-bitcoin-31144.md) | [IBD] multi-byte block obfuscation |
| bitcoin/bitcoin | [#31829](prs/auto-bitcoin-bitcoin-31829.md) | p2p: improve TxOrphanage denial of service bounds |
| browser-use/browser-use | [#3471](prs/auto-browser-use-browser-use-3471.md) | fix-required |
| browser-use/browser-use | [#3549](prs/auto-browser-use-browser-use-3549.md) | feat: improved navigate to URL event logic and wait mechanis |
| browser-use/browser-use | [#857](prs/auto-browser-use-browser-use-857.md) | Add anti bot detection via patchright |
| clash-verge-rev/clash-verge-rev | [#6052](prs/auto-clash-verge-rev-clash-verge-rev-6052.md) | feat(tunnels): add tunnels viewer UI with add/delete support |
| clash-verge-rev/clash-verge-rev | [#6487](prs/auto-clash-verge-rev-clash-verge-rev-6487.md) | feat(tray): 恢复并重构托盘显示速率功能 |
| clash-verge-rev/clash-verge-rev | [#6922](prs/auto-clash-verge-rev-clash-verge-rev-6922.md) | chore(deps): update npm dependencies (major) |
| cockroachdb/cockroach | [#131850](prs/auto-cockroachdb-cockroach-131850.md) | raft: add tracing to raft |
| cockroachdb/cockroach | [#138872](prs/auto-cockroachdb-cockroach-138872.md) | ccl/changefeedccl: add compression options for webhook sink |
| Comfy-Org/ComfyUI | [#13408](prs/auto-comfy-org-comfyui-13408.md) | feat: SAM (segment anything) 3.1 support (CORE-34) |
| Comfy-Org/ComfyUI | [#2666](prs/auto-comfy-org-comfyui-2666.md) | Execution Model Inversion |
| Comfy-Org/ComfyUI | [#7063](prs/auto-comfy-org-comfyui-7063.md) | MultiGPU Work Units For Accelerated Sampling (CORE-184) |
| Comfy-Org/ComfyUI | [#7223](prs/auto-comfy-org-comfyui-7223.md) | Add --use-flash-attention flag. |
| denoland/deno | [#25470](prs/auto-denoland-deno-25470.md) | fix(ext/node): support createConnection option in node:http. |
| denoland/deno | [#27527](prs/auto-denoland-deno-27527.md) | feat(unstable): Geometry Interfaces Module Level 1 |
| django/django | [#18056](prs/auto-django-django-18056.md) | Fixed #373 -- Added CompositePrimaryKey. |
| django/django | [#18158](prs/auto-django-django-18158.md) | Fixed #35515 -- Added auto-importing to shell command. |
| django/django | [#18823](prs/auto-django-django-18823.md) | Fixed #28041 -- Added Lexeme expression to contrib.postgres. |
| django/django | [#19643](prs/auto-django-django-19643.md) | Fixed #36410 -- Added named template partials to DTL |
| dotnet/runtime | [#102655](prs/auto-dotnet-runtime-102655.md) | NonBacktracking Regex optimizations |
| dotnet/runtime | [#123819](prs/auto-dotnet-runtime-123819.md) | New function pointer APIs |
| EbookFoundation/free-programming-books | [#11781](prs/auto-ebookfoundation-free-programming-books-11781.md) | Added Playground for different languages |
| elastic/elasticsearch | [#119886](prs/auto-elastic-elasticsearch-119886.md) | ESQL: Initial support for unmapped fields |
| electron/electron | [#42953](prs/auto-electron-electron-42953.md) | feat: GPU shared texture offscreen rendering |
| electron/electron | [#44411](prs/auto-electron-electron-44411.md) | feat: service worker preload scripts for improved extensions |
| electron/electron | [#48149](prs/auto-electron-electron-48149.md) | feat: add `copyVideoFrameAt` and `saveVideoFrameAs` methods  |
| electron/electron | [#48911](prs/auto-electron-electron-48911.md) | feat: allow SF Symbols to be customised |
| electron/electron | [#50043](prs/auto-electron-electron-50043.md) | feat: capture JS stack trace on renderer OOM |
| envoyproxy/envoy | [#32465](prs/auto-envoyproxy-envoy-32465.md) | new extension for TLS cert selection |
| envoyproxy/envoy | [#34942](prs/auto-envoyproxy-envoy-34942.md) | Enhance ext_proc filter to support MXN streaming |
| envoyproxy/envoy | [#35545](prs/auto-envoyproxy-envoy-35545.md) | access log: new 20x faster json formatter implementation |
| envoyproxy/envoy | [#42762](prs/auto-envoyproxy-envoy-42762.md) | http: add sse_to_metadata filter for stream parsing |
| envoyproxy/envoy | [#43812](prs/auto-envoyproxy-envoy-43812.md) | StatsAccessLogger:  fixes connection gauge underflow crashes |
| eslint/eslint | [#18134](prs/auto-eslint-eslint-18134.md) | feat: Add support for TS config files |
| eslint/eslint | [#18352](prs/auto-eslint-eslint-18352.md) | feat: add suggestions to `no-unused-vars` |
| eslint/eslint | [#18784](prs/auto-eslint-eslint-18784.md) | docs: add tabs to cli code blocks |
| eslint/eslint | [#19643](prs/auto-eslint-eslint-19643.md) | chore: add initial ecosystem plugin tests workflow |
| excalidraw/excalidraw | [#8012](prs/auto-excalidraw-excalidraw-8012.md) | feat: introduce font picker |
| facebook/react | [#28491](prs/auto-facebook-react-28491.md) | Add `React.useActionState` |
| facebook/react | [#30774](prs/auto-facebook-react-30774.md) | feat(eslint-plugin-react-hooks): support flat config |
| facebook/react-native | [#49135](prs/auto-facebook-react-native-49135.md) | [0.76] Bump Kotlin to 1.9.25 to mitigate #49115 |
| farion1231/cc-switch | [#930](prs/auto-farion1231-cc-switch-930.md) | feat(copilot): add GitHub Copilot reverse proxy support |
| fastapi/fastapi | [#13412](prs/auto-fastapi-fastapi-13412.md) | 🌐 Add Russian translation for  `docs/ru/docs/tutorial/middle |
| flutter/flutter | [#157755](prs/auto-flutter-flutter-157755.md) | [web] On the web platform, use an <img> tag to show an image |
| flutter/flutter | [#158255](prs/auto-flutter-flutter-158255.md) | Implement RawMenuAnchor |
| flutter/flutter | [#167806](prs/auto-flutter-flutter-167806.md) | Add RawMenuAnchor animation callbacks |
| flutter/flutter | [#172478](prs/auto-flutter-flutter-172478.md) | Add the 'windowing' feature flag and use to wrap an implemen |
| freeCodeCamp/freeCodeCamp | [#62735](prs/auto-freecodecamp-freecodecamp-62735.md) | feat(curriculum): add second flexbox workshop to FSD cert |
| garrytan/gstack | [#1](prs/auto-garrytan-gstack-1.md) | docs: add README and CLAUDE.md |
| Genymobile/scrcpy | [#5370](prs/auto-genymobile-scrcpy-5370.md) | Add virtual display feature |
| Genymobile/scrcpy | [#5455](prs/auto-genymobile-scrcpy-5455.md) | On-device OpenGL video filters |
| Genymobile/scrcpy | [#6216](prs/auto-genymobile-scrcpy-6216.md) | Migrate from SDL2 to SDL3 |
| Genymobile/scrcpy | [#6772](prs/auto-genymobile-scrcpy-6772.md) | Add flex display support (resizable virtual display) |
| ggml-org/llama.cpp | [#14939](prs/auto-ggml-org-llama-cpp-14939.md) | model: Add support for GLM 4.5 family of models (#14921) |
| ggml-org/llama.cpp | [#16095](prs/auto-ggml-org-llama-cpp-16095.md) | Model: Qwen3 Next |
| ggml-org/llama.cpp | [#18655](prs/auto-ggml-org-llama-cpp-18655.md) | webui: Agentic Loop + MCP Client with support for Tools, Res |
| ggml-org/llama.cpp | [#18675](prs/auto-ggml-org-llama-cpp-18675.md) | Autoparser - complete refactoring of parser architecture |
| ggml-org/llama.cpp | [#22673](prs/auto-ggml-org-llama-cpp-22673.md) | llama + spec: MTP Support |
| gin-gonic/gin | [#3963](prs/auto-gin-gonic-gin-3963.md) | refactor(context): refactor `Keys` type to `map[any]any` |
| godotengine/godot | [#102552](prs/auto-godotengine-godot-102552.md) | Add shader baker to project exporter. |
| godotengine/godot | [#102987](prs/auto-godotengine-godot-102987.md) | [LinuxBSD] Add support for HDR output (Wayland) |
| godotengine/godot | [#107391](prs/auto-godotengine-godot-107391.md) | OpenXR: Add support for spatial entities extension |
| godotengine/godot | [#94496](prs/auto-godotengine-godot-94496.md) | [Windows] Support output to HDR monitors |
| godotengine/godot | [#97210](prs/auto-godotengine-godot-97210.md) | Add an ObjectDB Profiling Tool |
| google-gemini/gemini-cli | [#21212](prs/auto-google-gemini-gemini-cli-21212.md) | feat(ui): implement refreshed UX for Composer layout |
| google-gemini/gemini-cli | [#26361](prs/auto-google-gemini-gemini-cli-26361.md) | fix(core): externalize https-proxy-agent to fix proxy suppor |
| google-gemini/gemini-cli | [#3289](prs/auto-google-gemini-gemini-cli-3289.md) | Add terminal setup command for Shift+Enter and Ctrl+Enter su |
| google-gemini/gemini-cli | [#8290](prs/auto-google-gemini-gemini-cli-8290.md) | Fix MCP prompt slash commands not appearing. |
| grafana/grafana | [#104207](prs/auto-grafana-grafana-104207.md) | Sharing: Export dashboard as image |
| grafana/grafana | [#85838](prs/auto-grafana-grafana-85838.md) | Gops: Add configuration tracker on the existing IRM page |
| grafana/grafana | [#96329](prs/auto-grafana-grafana-96329.md) | AppPlatform: Introduce experimental Github integration for d |
| huggingface/transformers | [#29077](prs/auto-huggingface-transformers-29077.md) | New model support RTDETR |
| huggingface/transformers | [#29886](prs/auto-huggingface-transformers-29886.md) | Add SuperGlue model |
| huggingface/transformers | [#30530](prs/auto-huggingface-transformers-30530.md) | Add ViTPose |
| huggingface/transformers | [#36895](prs/auto-huggingface-transformers-36895.md) | Add RF-DETR |
| immich-app/immich | [#26881](prs/auto-immich-app-immich-26881.md) | fix(server): sync files to disk |
| immich-app/immich | [#6192](prs/auto-immich-app-immich-6192.md) | feat(server): Automatic watching of library folders |
| immich-app/immich | [#6455](prs/auto-immich-app-immich-6455.md) | feat(server): Import face regions from metadata |
| jaywcjlove/awesome-mac | [#1930](prs/auto-jaywcjlove-awesome-mac-1930.md) | Add TouchBridge — free Touch ID alternative for Macs without |
| JetBrains/kotlin | [#5720](prs/auto-jetbrains-kotlin-5720.md) | Introduce JKlib pipeline |
| JetBrains/kotlin | [#5762](prs/auto-jetbrains-kotlin-5762.md) | [Build] Introduce 'Test Federation' |
| JetBrains/kotlin | [#5875](prs/auto-jetbrains-kotlin-5875.md) | [Wasm] Replace first stage test config with phased CLI infra |
| JetBrains/kotlin | [#5926](prs/auto-jetbrains-kotlin-5926.md) | [BTA] Prepare BTA/JS for integration into KGP |
| krahets/hello-algo | [#1163](prs/auto-krahets-hello-algo-1163.md) | feat: Traditional Chinese version |
| krahets/hello-algo | [#1831](prs/auto-krahets-hello-algo-1831.md) | add epub generator |
| kubernetes/enhancements | [#4384](prs/auto-kubernetes-enhancements-4384.md) | KEP 4381: add structured parameters for dynamic resource all |
| kubernetes/enhancements | [#4565](prs/auto-kubernetes-enhancements-4565.md) | KEP-4563: EvictionRequest API |
| kubernetes/enhancements | [#5136](prs/auto-kubernetes-enhancements-5136.md) | Add KEP for DRA: Extended Resource |
| kubernetes/enhancements | [#5347](prs/auto-kubernetes-enhancements-5347.md) | KEP-5328:Node Declared Features (formerly Node Capabilities) |
| kubernetes/kubernetes | [#125488](prs/auto-kubernetes-kubernetes-125488.md) | DRA for 1.31 |
| kubernetes/kubernetes | [#128010](prs/auto-kubernetes-kubernetes-128010.md) | Pod Certificates: Preliminary implementation of KEP-4317 |
| kubernetes/kubernetes | [#130160](prs/auto-kubernetes-kubernetes-130160.md) | Implement DRA Device Binding Conditions (KEP-5007) |
| kubernetes/kubernetes | [#130653](prs/auto-kubernetes-kubernetes-130653.md) | kubelet and scheduler for extended resource backed by DRA |
| kubernetes/kubernetes | [#134768](prs/auto-kubernetes-kubernetes-134768.md) | [PodLevelResourceManagers] Pod Level Resource Managers - Alp |
| langchain-ai/langchain | [#20881](prs/auto-langchain-ai-langchain-20881.md) | [experimental][llms][OllamaFunctions] Add bind_tools and wit |
| langflow-ai/langflow | [#10081](prs/auto-langflow-ai-langflow-10081.md) | docs: 1.7 release branch |
| langflow-ai/langflow | [#7741](prs/auto-langflow-ai-langflow-7741.md) | feat: Add MCP Server Settings to projects, rename Folder to  |
| langflow-ai/langflow | [#8387](prs/auto-langflow-ai-langflow-8387.md) | docs: 1.5 release |
| langflow-ai/langflow | [#8721](prs/auto-langflow-ai-langflow-8721.md) | docs: add required API key headers for 1.5 |
| langflow-ai/langflow | [#9521](prs/auto-langflow-ai-langflow-9521.md) | docs: 1.6 feature branch |
| langgenius/dify | [#30781](prs/auto-langgenius-dify-30781.md) | feat: collaboration |
| langgenius/dify | [#32780](prs/auto-langgenius-dify-32780.md) | refactor: Unify NodeConfigDict.data and BaseNodeData |
| langgenius/dify | [#33138](prs/auto-langgenius-dify-33138.md) | feat: enterprise otel exporter |
| langgenius/dify | [#33580](prs/auto-langgenius-dify-33580.md) | refactor(api): continue decoupling dify_graph from API conce |
| llvm/llvm-project | [#102323](prs/auto-llvm-llvm-project-102323.md) | [llvm]Add a simple Telemetry framework |
| llvm/llvm-project | [#113510](prs/auto-llvm-llvm-project-113510.md) | [RFC] Initial implementation of P2719 |
| llvm/llvm-project | [#156262](prs/auto-llvm-llvm-project-156262.md) | [VPlan] Make canonical IV part of the region |
| llvm/llvm-project | [#84983](prs/auto-llvm-llvm-project-84983.md) | nonblocking/nonallocating attributes (was: nolock/noalloc) |
| llvm/llvm-project | [#92418](prs/auto-llvm-llvm-project-92418.md) | [LoopVectorizer] Add support for partial reductions |
| microsoft/generative-ai-for-beginners | [#1180](prs/auto-microsoft-generative-ai-for-beginners-1180.md) | chore(i18n): sync translations with latest source changes |
| microsoft/generative-ai-for-beginners | [#293](prs/auto-microsoft-generative-ai-for-beginners-293.md) | Add Spanish Translation (es-mx) |
| microsoft/generative-ai-for-beginners | [#305](prs/auto-microsoft-generative-ai-for-beginners-305.md) | Fixed typos |
| microsoft/playwright | [#31529](prs/auto-microsoft-playwright-31529.md) | feat: support client certificates |
| microsoft/playwright | [#31727](prs/auto-microsoft-playwright-31727.md) | feat(test runner): `--only-changed` option |
| microsoft/playwright | [#32156](prs/auto-microsoft-playwright-32156.md) | chore(test runner): rebase watch mode onto TestServerConnect |
| microsoft/playwright | [#36358](prs/auto-microsoft-playwright-36358.md) | feat(webkit): allow running WebKit via WSL on Windows |
| microsoft/PowerToys | [#40834](prs/auto-microsoft-powertoys-40834.md) | Shortcut Guide V2 |
| microsoft/PowerToys | [#41961](prs/auto-microsoft-powertoys-41961.md) | CmdPal: Make Bookmarks Great and Fast Again |
| microsoft/PowerToys | [#42642](prs/auto-microsoft-powertoys-42642.md) | Introduce new utility PowerDisplay to control your monitor s |
| microsoft/PowerToys | [#43090](prs/auto-microsoft-powertoys-43090.md) | CmdPal: New Remote Desktop built-in extension |
| microsoft/PowerToys | [#46915](prs/auto-microsoft-powertoys-46915.md) | CmdPal Dock: Multi-monitor support |
| microsoft/terminal | [#17510](prs/auto-microsoft-terminal-17510.md) | A minor ConPTY refactoring: Goodbye VtEngine Edition |
| microsoft/TypeScript | [#56941](prs/auto-microsoft-typescript-56941.md) | Narrow generic conditional and indexed access return types w |
| microsoft/TypeScript | [#57465](prs/auto-microsoft-typescript-57465.md) | Infer type predicates from function bodies using control flo |
| microsoft/TypeScript | [#57842](prs/auto-microsoft-typescript-57842.md) | Region-based semantic diagnostics |
| microsoft/TypeScript | [#58201](prs/auto-microsoft-typescript-58201.md) | Isolated declarations errors |
| microsoft/TypeScript | [#58243](prs/auto-microsoft-typescript-58243.md) | Add TReturn/TNext to Iterable et al |
| mrdoob/three.js | [#27586](prs/auto-mrdoob-three-js-27586.md) | WebXRManager: Added depth sensing support (v2). |
| mrdoob/three.js | [#31640](prs/auto-mrdoob-three-js-31640.md) | Examples: Add TSL Procedural Wood Material |
| mrdoob/three.js | [#31839](prs/auto-mrdoob-three-js-31839.md) | SSGINode: New node for screen-space global illumination. |
| mui/material-ui | [#41932](prs/auto-mui-material-ui-41932.md) | [blog] Add Material UI v6 stable release |
| mui/material-ui | [#46416](prs/auto-mui-material-ui-46416.md) | [website] Add Case studies to the homepage |
| n8n-io/n8n | [#18626](prs/auto-n8n-io-n8n-18626.md) | feat(NocoDB Node): Add new data apis and use new api version |
| n8n-io/n8n | [#30015](prs/auto-n8n-io-n8n-30015.md) | feat(core): Add native agent substrate (no-changelog) |
| neovim/neovim | [#31031](prs/auto-neovim-neovim-31031.md) | feat(lsp): add `vim.lsp.config` and `vim.lsp.enable` |
| neovim/neovim | [#31631](prs/auto-neovim-neovim-31631.md) | feat(treesitter): async parsing |
| neovim/neovim | [#32683](prs/auto-neovim-neovim-32683.md) | fix(env.c): drop envmap, callers must free os_getenv() resul |
| neovim/neovim | [#34009](prs/auto-neovim-neovim-34009.md) | feat(pack): add built-in plugin manager `vim.pack` |
| neovim/neovim | [#34846](prs/auto-neovim-neovim-34846.md) | feat(api): nvim_echo can emit Progress messages/events |
| nodejs/node | [#52190](prs/auto-nodejs-node-52190.md) | cli: implement `node --run <script-in-package-json>` |
| nodejs/node | [#53725](prs/auto-nodejs-node-53725.md) | module: add --experimental-strip-types |
| nodejs/node | [#54630](prs/auto-nodejs-node-54630.md) | assert: add partialDeepStrictEqual |
| nodejs/node | [#57343](prs/auto-nodejs-node-57343.md) | build, doc: use new api doc tooling |
| nodejs/node | [#61871](prs/auto-nodejs-node-61871.md) | buffer: improve performance of multiple Buffer operations |
| NousResearch/hermes-agent | [#19](prs/auto-nousresearch-hermes-agent-19.md) | Enhance async tool execution and error handling in Hermes ag |
| NousResearch/hermes-agent | [#4692](prs/auto-nousresearch-hermes-agent-4692.md) | Feat/ink refactor |
| numpy/numpy | [#26081](prs/auto-numpy-numpy-26081.md) | TYP: Make array _ShapeType bound and covariant |
| numpy/numpy | [#29129](prs/auto-numpy-numpy-29129.md) | ENH: add a casting option 'same_value' and use it in np.asty |
| numpy/numpy | [#29642](prs/auto-numpy-numpy-29642.md) | ENH: Add extended sorting APIs |
| numpy/numpy | [#29737](prs/auto-numpy-numpy-29737.md) | ENH, API: New sorting slots for DType API |
| ohmyzsh/ohmyzsh | [#12232](prs/auto-ohmyzsh-ohmyzsh-12232.md) | fix(tmux): do not pass empty flags to aliases |
| ollama/ollama | [#10415](prs/auto-ollama-ollama-10415.md) | tools: refactor tool call parsing and enable streaming |
| ollama/ollama | [#11090](prs/auto-ollama-ollama-11090.md) | New Memory Management |
| ollama/ollama | [#16031](prs/auto-ollama-ollama-16031.md) | runner: Remove CGO engines, use llama-server exclusively for |
| ollama/ollama | [#6279](prs/auto-ollama-ollama-6279.md) | feat: Introduce K/V Context Quantisation (vRAM improvements) |
| open-webui/open-webui | [#1165](prs/auto-open-webui-open-webui-1165.md) | refac: Dockerfile |
| open-webui/open-webui | [#17223](prs/auto-open-webui-open-webui-17223.md) | feat: Added support for redis as session storage |
| open-webui/open-webui | [#926](prs/auto-open-webui-open-webui-926.md) | Add i18n |
| openai/codex | [#13860](prs/auto-openai-codex-13860.md) | Add Smart Approvals guardian review across core, app-server, |
| openai/codex | [#22668](prs/auto-openai-codex-22668.md) | Wire managed MITM CA trust into child env |
| openclaw/openclaw | [#40946](prs/auto-openclaw-openclaw-40946.md) | Matrix: replace legacy plugin with new implementation |
| openclaw/openclaw | [#70864](prs/auto-openclaw-openclaw-70864.md) | feat: add scoped mention pattern policy |
| openclaw/openclaw | [#78595](prs/auto-openclaw-openclaw-78595.md) | Refactor runtime state into SQLite |
| oven-sh/bun | [#30412](prs/auto-oven-sh-bun-30412.md) | Rewrite Bun in Rust |
| pola-rs/polars | [#17995](prs/auto-pola-rs-polars-17995.md) | feat(python!): Use Altair in DataFrame.plot |
| pola-rs/polars | [#19894](prs/auto-pola-rs-polars-19894.md) | feat: Add `index_of()` function to `Series` and `Expr` |
| pola-rs/polars | [#22840](prs/auto-pola-rs-polars-22840.md) | feat: Reinterpret binary data to fixed size numerical array |
| prettier/prettier | [#16500](prs/auto-prettier-prettier-16500.md) | Handle exception in needs parens with optional chaining |
| prettier/prettier | [#18277](prs/auto-prettier-prettier-18277.md) | Upgrade to latest micromark (markdown only) |
| prometheus/prometheus | [#14495](prs/auto-prometheus-prometheus-14495.md) | [FEATURE] PromQL: Add experimental info function MVP |
| prometheus/prometheus | [#15687](prs/auto-prometheus-prometheus-15687.md) | Float histograms: implement methods for Add/Sub operations u |
| prometheus/prometheus | [#16355](prs/auto-prometheus-prometheus-16355.md) | feat(notifier): independent alertmanager sendloops |
| prometheus/prometheus | [#17671](prs/auto-prometheus-prometheus-17671.md) | tsdb(wal): st-per-sample initial code and benchmarks |
| pydantic/pydantic | [#8939](prs/auto-pydantic-pydantic-8939.md) | Fix TypeAdapter to respect defer_build |
| pydantic/pydantic | [#9459](prs/auto-pydantic-pydantic-9459.md) | Add pipeline API |
| pytorch/pytorch | [#152361](prs/auto-pytorch-pytorch-152361.md) | Build libgomp (gcc-13) from src on AArch64 |
| pytorch/pytorch | [#158613](prs/auto-pytorch-pytorch-158613.md) | Setup TorchBench in Docker |
| pytorch/pytorch | [#170486](prs/auto-pytorch-pytorch-170486.md) | [flex_attention] adds support for low precision K/V inputs i |
| rails/rails | [#51674](prs/auto-rails-rails-51674.md) | Add `Parameters#expect` to safely filter and require params |
| rails/rails | [#55334](prs/auto-rails-rails-55334.md) | Structured Event Reporting in Rails |
| rasbt/LLMs-from-scratch | [#229](prs/auto-rasbt-llms-from-scratch-229.md) | fixed num_workers |
| rasbt/LLMs-from-scratch | [#241](prs/auto-rasbt-llms-from-scratch-241.md) | Show epochs as integers on x-axis |
| rasbt/LLMs-from-scratch | [#828](prs/auto-rasbt-llms-from-scratch-828.md) | `Qwen3Tokenizer` fix for Qwen3 Base models and generation mi |
| remix-run/react-router | [#11380](prs/auto-remix-run-react-router-11380.md) | Initial Migration |
| remix-run/react-router | [#12019](prs/auto-remix-run-react-router-12019.md) | Typesafety improvements |
| remix-run/react-router | [#12941](prs/auto-remix-run-react-router-12941.md) | Add support for client context and middleware (unstable) |
| remix-run/react-router | [#14716](prs/auto-remix-run-react-router-14716.md) | Add support for <Link unstable_mask> |
| rust-lang/cargo | [#13709](prs/auto-rust-lang-cargo-13709.md) | feat: implement RFC 3553 to add SBOM support |
| rust-lang/cargo | [#14615](prs/auto-rust-lang-cargo-14615.md) | Add terminal integration via ANSI OSC 9;4 sequences |
| rust-lang/cargo | [#16131](prs/auto-rust-lang-cargo-16131.md) | Warn when installing with a non-default toolchain |
| rust-lang/cargo | [#16155](prs/auto-rust-lang-cargo-16155.md) | Implement fine grain locking for `build-dir` |
| rust-lang/rfcs | [#3668](prs/auto-rust-lang-rfcs-3668.md) | Async closures |
| rust-lang/rfcs | [#3681](prs/auto-rust-lang-rfcs-3681.md) | [RFC] Default field values |
| rust-lang/rfcs | [#3892](prs/auto-rust-lang-rfcs-3892.md) | Complex numbers |
| rust-lang/rfcs | [#3923](prs/auto-rust-lang-rfcs-3923.md) | Cargo RFC for min publish age |
| rust-lang/rfcs | [#3931](prs/auto-rust-lang-rfcs-3931.md) | Rust Foundation Maintainer Fund |
| rust-lang/rust | [#129458](prs/auto-rust-lang-rust-129458.md) | Autodiff Upstreaming - enzyme frontend |
| rust-lang/rust | [#137944](prs/auto-rust-lang-rust-137944.md) | Sized Hierarchy: Part I |
| rust-lang/rust | [#139493](prs/auto-rust-lang-rust-139493.md) | Explicitly export core and std macros |
| rust-lang/rust | [#141295](prs/auto-rust-lang-rust-141295.md) | Stabilize `if let` guards (`feature(if_let_guard)`) |
| rust-lang/rust | [#142771](prs/auto-rust-lang-rust-142771.md) | Introduce debuginfo to statements in MIR |
| rustdesk/rustdesk | [#13247](prs/auto-rustdesk-rustdesk-13247.md) | Edge scrolling |
| rustdesk/rustdesk | [#14671](prs/auto-rustdesk-rustdesk-14671.md) | fix(ipc): harden local IPC authorization and portable-servic |
| rustdesk/rustdesk | [#14700](prs/auto-rustdesk-rustdesk-14700.md) | fix(keyboard): wayland clipboard input prompt |
| scikit-learn/scikit-learn | [#30399](prs/auto-scikit-learn-scikit-learn-30399.md) | ENH add `from_cv_results` in `RocCurveDisplay` (single `RocC |
| scikit-learn/scikit-learn | [#31937](prs/auto-scikit-learn-scikit-learn-31937.md) | ENH: Display the number and names of output features |
| scikit-learn/scikit-learn | [#32119](prs/auto-scikit-learn-scikit-learn-32119.md) | FEA Add support for missing values in tree estimators with ` |
| scikit-learn/scikit-learn | [#32644](prs/auto-scikit-learn-scikit-learn-32644.md) | FEA Add array API support for LogisticRegression with LBFGS |
| shadcn-ui/ui | [#2945](prs/auto-shadcn-ui-ui-2945.md) | fix: Command/Combobox TypeError and Unclickable/Disabled ite |
| shadcn-ui/ui | [#8486](prs/auto-shadcn-ui-ui-8486.md) | feat: update chart to recharts v3 |
| shadcn-ui/ui | [#9929](prs/auto-shadcn-ui-ui-9929.md) | Add fontsource and support override for registry:font instal |
| Significant-Gravitas/AutoGPT | [#12629](prs/auto-significant-gravitas-autogpt-12629.md) | feat(platform): add copilot artifact preview panel |
| Significant-Gravitas/AutoGPT | [#12699](prs/auto-significant-gravitas-autogpt-12699.md) | feat(builder): AI chat panel for the flow builder |
| Significant-Gravitas/AutoGPT | [#12727](prs/auto-significant-gravitas-autogpt-12727.md) | feat(platform): subscription tier billing via Stripe Checkou |
| supabase/supabase | [#23714](prs/auto-supabase-supabase-23714.md) | feature: warehouse |
| sveltejs/svelte | [#14211](prs/auto-sveltejs-svelte-14211.md) | feat: add error boundaries |
| sveltejs/svelte | [#15000](prs/auto-sveltejs-svelte-15000.md) | feat: attachments |
| swiftlang/swift | [#71688](prs/auto-swiftlang-swift-71688.md) | [stdlib] Start adopting noncopyable generics in the stdlib |
| swiftlang/swift | [#71775](prs/auto-swiftlang-swift-71775.md) | [Autodiff] Adds part of the Autodiff specific closure-specia |
| swiftlang/swift | [#72161](prs/auto-swiftlang-swift-72161.md) | [android] add a module map for Android NDK |
| swiftlang/swift | [#80941](prs/auto-swiftlang-swift-80941.md) | [SE-0489] Better `debugDescription` for `EncodingError` and  |
| swiftlang/swift | [#86010](prs/auto-swiftlang-swift-86010.md) | Rework ForEachStmt Desugaring |
| symfony/symfony | [#54141](prs/auto-symfony-symfony-54141.md) | [Messenger] Introduce `DeduplicateMiddleware` |
| symfony/symfony | [#58095](prs/auto-symfony-symfony-58095.md) | [Security] Implement stateless headers/cookies-based CSRF pr |
| symfony/symfony | [#59576](prs/auto-symfony-symfony-59576.md) | [HttpClient] Make `CachingHttpClient` compatible with RFC 91 |
| symfony/symfony | [#60212](prs/auto-symfony-symfony-60212.md) | [Form] Add `FormFlow` for multistep forms management |
| tauri-apps/tauri | [#12668](prs/auto-tauri-apps-tauri-12668.md) | feat: introduce `App::run_return` |
| tauri-apps/tauri | [#13993](prs/auto-tauri-apps-tauri-13993.md) | feat(cli): check plugin versions for incompatibilities |
| tauri-apps/tauri | [#14523](prs/auto-tauri-apps-tauri-14523.md) | Fix(macos/ios): Add handler for web content process terminat |
| tauri-apps/tauri | [#14959](prs/auto-tauri-apps-tauri-14959.md) | refactor: replace `kuchikiki` with `dom_query` |
| tensorflow/tensorflow | [#62883](prs/auto-tensorflow-tensorflow-62883.md) | [oneDNN] Add oneDNN version of SparseMatrixMatMul |
| tensorflow/tensorflow | [#84975](prs/auto-tensorflow-tensorflow-84975.md) | build(aarch64): Update to oneDNN-3.7 + ACL-24.12 |
| tensorflow/tensorflow | [#93951](prs/auto-tensorflow-tensorflow-93951.md) | build(aarch64): Update to oneDNN-3.7 + ACL-24.12 (fix) |
| twbs/bootstrap | [#40623](prs/auto-twbs-bootstrap-40623.md) | Fix use of declarations after nested rules (deprecated in Sa |
| twbs/bootstrap | [#42165](prs/auto-twbs-bootstrap-42165.md) | Refine Stepper component |
| vercel/next.js | [#79787](prs/auto-vercel-next-js-79787.md) | [dynamicIO] Document client component remediations for sync  |
| vercel/next.js | [#81396](prs/auto-vercel-next-js-81396.md) | feat: automatically generate route types |
| vitejs/vite | [#16129](prs/auto-vitejs-vite-16129.md) | feat: environment api |
| vitejs/vite | [#16471](prs/auto-vitejs-vite-16471.md) | feat: v6 - Environment API |
| vitejs/vite | [#18362](prs/auto-vitejs-vite-18362.md) | feat: use a single transport for fetchModule and HMR support |
| vuejs/core | [#11797](prs/auto-vuejs-core-11797.md) | fix(reactivity): prevent endless recursion in computed gette |
| vuejs/core | [#12349](prs/auto-vuejs-core-12349.md) | perf(reactivity): ports `alien-signals` 0.4.4 |
| vuejs/core | [#13352](prs/auto-vuejs-core-13352.md) | fix(compiler-sfc): add error handling for defineModel() with |
| vuejs/core | [#13934](prs/auto-vuejs-core-13934.md) | test(vapor): use browser mode instead of pupeteer to run tes |
| WebKit/WebKit | [#34862](prs/auto-webkit-webkit-34862.md) | [TextureMapper] Preserve-3d layers don't get flattened corre |
| WebKit/WebKit | [#48322](prs/auto-webkit-webkit-48322.md) | Implement speculation rules - same origin conservative prefe |
| WebKit/WebKit | [#50706](prs/auto-webkit-webkit-50706.md) | Add support for loading USDs in WCP and rendering them in GP |
| WebKit/WebKit | [#51619](prs/auto-webkit-webkit-51619.md) | [WTF] Make CStringView handle only null termination related  |
| WebKit/WebKit | [#57827](prs/auto-webkit-webkit-57827.md) | [JSC] Rewrite module loader |
| yt-dlp/yt-dlp | [#9775](prs/auto-yt-dlp-yt-dlp-9775.md) | [ie/youtube] Extract comments with or without new format |
| zed-industries/zed | [#13433](prs/auto-zed-industries-zed-13433.md) | Debugger implementation |
| zed-industries/zed | [#19230](prs/auto-zed-industries-zed-19230.md) | lsp: Implement support for the `textDocument/diagnostic` com |
| zed-industries/zed | [#20400](prs/auto-zed-industries-zed-20400.md) | Windows: Add transparency effect |
| zed-industries/zed | [#21675](prs/auto-zed-industries-zed-21675.md) | Add image dimension and file size information |
| zed-industries/zed | [#26893](prs/auto-zed-industries-zed-26893.md) | editor: Add minimap |
| ziglang/zig | [#20271](prs/auto-ziglang-zig-20271.md) | ZON |
| ziglang/zig | [#20511](prs/auto-ziglang-zig-20511.md) | runtime page size detection + rework GeneralPurposeAllocator |
| ziglang/zig | [#23441](prs/auto-ziglang-zig-23441.md) | std.os.uefi.tables: ziggify boot and runtime services |
