# vendored: volley-core (DuplexCascade turn-taking FSM)

The deterministic, echo-aware, full-duplex turn-taking control plane for the live
voice agent — onset, end-pointing, and barge-in, decided in-process at audio rate.
Driven from [`core/voiceAudio.ts`](../../core/voiceAudio.ts) via `Engine.pushMic(frame)`.

**Why a separate ~18 KB wasm (not folded into `drift-static-profiler`):** the scanner
is a WASI **run-to-completion command** (argv in → JSON out → exit); this is a
**stateful wasm-bindgen library** called ~50×/sec holding state across calls. Opposite
execution models — you can't re-enter a WASI command with a new audio frame. Keeping
the FSM local (vs. Cloudflare's server-side Deepgram Flux end-pointing) also removes a
WebSocket round-trip from every turn decision: lowest-latency turn-taking.

**Source is IN THIS REPO:** [`crates/volley-core`](../../../crates/volley-core) (Apache-2.0 OR
MIT, vendored from `audio-to-audio/volley`). These three files (`volley_core.js`,
`volley_core.d.ts`, `volley_core_bg.wasm`) are GENERATED — the committed
`wasm-pack build --target web` output — so `npm run build` needs no Rust toolchain.

**To rebuild after editing the Rust:** `npm run build:voice-wasm`
(→ [`scripts/build-voice-wasm.sh`](../../../scripts/build-voice-wasm.sh)), or just
`make voice-wasm`. During `make dev` you don't need to: a watcher
([`scripts/watch-voice-wasm.mjs`](../../../scripts/watch-voice-wasm.mjs)) rebuilds these
three files whenever `crates/volley-core/src/*.rs` changes, and Vite HMR reloads the
live agent. The FSM has its own Rust unit tests:
`cargo test --lib --manifest-path crates/volley-core/Cargo.toml`.
Tuning (`Config`) is set in [`voiceAudio.ts`](../../core/voiceAudio.ts) `TUNING`; keep it
consistent with `volley-core`'s `Config::default()`.
