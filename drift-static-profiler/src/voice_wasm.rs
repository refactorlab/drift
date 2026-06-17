//! C-ABI wasm export surface for the voice control plane (VAD + DuplexCascade FSM).
//!
//! WHY this is not wasm-bindgen: the extension already ships ONE wasm — a WASI
//! command (`wasm32-wasip1`, built by wasi-sdk clang for the tree-sitter C
//! grammars) loaded through `@bjorn3/browser_wasi_shim`. wasm-bindgen targets
//! `wasm32-unknown-unknown` with its own JS glue + instantiation model and does
//! not mix cleanly with a WASI binary. So the voice FSM rides in the SAME
//! binary, exposed through a tiny raw C-ABI: JS marshals 20 ms `f32` mic frames
//! through linear memory and gets back a single integer action code. No model
//! tensors ever cross here — they stay in ONNX Runtime / WebGPU on the JS side.
//!
//! RUNTIME MODEL: the scanner path runs `_start` (CLI → exit) unchanged. The
//! voice path instantiates the SAME module but NEVER calls `_start`; it calls
//! `__wasm_call_ctors` once (heap init) then these exports directly, keeping one
//! long-lived `DuplexFsm` per `vad_new` handle.
//!
//! Gated to `wasm32` (see the `#[cfg]` on the `mod voice_wasm;` in main.rs), so
//! native builds and `cargo test` never see any of this.

use drift_static_profiler::voice::{resample_linear, rms, Action, Config, DuplexFsm};

/// Action codes returned by [`vad_push_mic`] (kept in sync with Volley's protocol.mjs):
/// 0 = none, 1 = user-started, 2 = commit-utterance, 3 = barge-in.
fn action_code(a: Action) -> u32 {
    match a {
        Action::None => 0,
        Action::UserStarted => 1,
        Action::CommitUtterance => 2,
        Action::BargeIn => 3,
    }
}

// ---------------------------------------------------------------------------
// Linear-memory marshaling. Audio buffers are `f32`, so the allocation is
// 4-byte aligned and JS can build a `Float32Array` view over `memory.buffer`
// at the returned pointer with no copy. JS owns the lifetime: alloc → write →
// call → (read) → free.
// ---------------------------------------------------------------------------

/// Allocate `n` f32 samples in linear memory; returns the byte pointer (a `u32`
/// in wasm32). JS writes via `new Float32Array(memory.buffer, ptr, n)`.
#[no_mangle]
pub extern "C" fn vp_alloc_f32(n: usize) -> *mut f32 {
    let mut buf = Vec::<f32>::with_capacity(n);
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf); // ownership handed to JS; reclaimed via vp_free_f32
    ptr
}

/// Free a buffer previously returned by [`vp_alloc_f32`] / [`vad_resample`].
/// `n` must be the same sample count that was allocated.
///
/// # Safety
/// `ptr` must come from `vp_alloc_f32(n)` (or `vad_resample`'s returned ptr with
/// its reported length) and must not be used afterwards.
#[no_mangle]
pub unsafe extern "C" fn vp_free_f32(ptr: *mut f32, n: usize) {
    if !ptr.is_null() && n != 0 {
        // length 0, capacity n → frees the original allocation without dropping
        // any (already-overwritten-by-JS) elements.
        drop(Vec::from_raw_parts(ptr, 0, n));
    }
}

// ---------------------------------------------------------------------------
// FSM lifecycle + per-frame control. The handle is a raw `*mut DuplexFsm`
// (a `u32` to JS); JS treats it as an opaque token.
// ---------------------------------------------------------------------------

/// Construct a DuplexCascade FSM with explicit timing (all counts in 20 ms
/// frames). `floor_margin == 0` disables the adaptive noise floor (fixed gate).
/// Returns an opaque handle; free it with [`vad_free`].
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn vad_new(
    vad_threshold: f32,
    vad_hang: u32,
    min_speech_frames: u32,
    end_silence_frames: u32,
    barge_speech_frames: u32,
    echo_margin: f32,
    floor_margin: f32,
) -> *mut DuplexFsm {
    let cfg = Config {
        vad_threshold,
        vad_hang,
        min_speech_frames,
        end_silence_frames,
        barge_speech_frames,
        echo_margin,
        floor_margin,
    };
    Box::into_raw(Box::new(DuplexFsm::new(cfg)))
}

/// Release an FSM handle from [`vad_new`].
///
/// # Safety
/// `h` must be a live handle from `vad_new` and unused afterwards.
#[no_mangle]
pub unsafe extern "C" fn vad_free(h: *mut DuplexFsm) {
    if !h.is_null() {
        drop(Box::from_raw(h));
    }
}

/// Feed one mic frame (`len` f32 samples at `ptr`); returns the action code
/// (see [`action_code`]).
///
/// # Safety
/// `h` is a live handle; `ptr`/`len` describe a readable f32 region (typically
/// from `vp_alloc_f32`).
#[no_mangle]
pub unsafe extern "C" fn vad_push_mic(h: *mut DuplexFsm, ptr: *const f32, len: usize) -> u32 {
    let fsm = &mut *h;
    let frame = core::slice::from_raw_parts(ptr, len);
    action_code(fsm.on_mic_frame(frame))
}

/// JS reports the agent's TTS started / stopped playing.
///
/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_set_speaking(h: *mut DuplexFsm, speaking: u32) {
    (*h).set_speaking(speaking != 0);
}

/// JS reports the brain/TTS pipeline started after a commit.
///
/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_set_thinking(h: *mut DuplexFsm) {
    (*h).set_thinking();
}

/// Enable/disable barge-in DURING Thinking (off for slow remote brains).
///
/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_set_barge_in_thinking(h: *mut DuplexFsm, on: u32) {
    (*h).set_barge_in_thinking(on != 0);
}

/// JS reports the RMS of the audio the agent is currently playing (echo-aware
/// barge-in gate). 0 when silent.
///
/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_set_output_level(h: *mut DuplexFsm, level: f32) {
    (*h).set_output_level(level);
}

/// Current state: 0 = listening, 1 = thinking, 2 = speaking.
///
/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_state_code(h: *mut DuplexFsm) -> u32 {
    use drift_static_profiler::voice::State;
    match (*h).state() {
        State::Listening => 0,
        State::Thinking => 1,
        State::Speaking => 2,
    }
}

/// Reset the FSM to its initial Listening state (turn boundary).
///
/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_reset(h: *mut DuplexFsm) {
    (*h).reset();
}

// --- read-only telemetry (no control-flow effect; UI VAD viz / tuning / debug) ---

/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_get_last_energy(h: *mut DuplexFsm) -> f32 {
    (*h).last_energy()
}

/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_get_effective_gate(h: *mut DuplexFsm) -> f32 {
    (*h).effective_gate()
}

/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_get_noise_floor(h: *mut DuplexFsm) -> f32 {
    (*h).noise_floor()
}

/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_get_barge_run(h: *mut DuplexFsm) -> u32 {
    (*h).barge_run()
}

/// # Safety
/// `h` is a live handle.
#[no_mangle]
pub unsafe extern "C" fn vad_get_last_reason(h: *mut DuplexFsm) -> u32 {
    (*h).last_reason() as u32
}

// ---------------------------------------------------------------------------
// Stateless DSP helpers.
// ---------------------------------------------------------------------------

/// RMS of `len` f32 samples at `ptr` (JS uses it to report agent output level).
///
/// # Safety
/// `ptr`/`len` describe a readable f32 region.
#[no_mangle]
pub unsafe extern "C" fn vad_rms(ptr: *const f32, len: usize) -> f32 {
    rms(core::slice::from_raw_parts(ptr, len))
}

/// Resample `len` f32 samples at `in_ptr` from `in_rate` → `out_rate`. Allocates
/// the output in linear memory, writes its sample count to `*out_len`, and
/// returns its pointer. JS reads the result then frees it with
/// [`vp_free_f32`]`(ret, *out_len)`. (The worker uses 24 kHz → 16 kHz for Whisper.)
///
/// # Safety
/// `in_ptr`/`len` describe a readable f32 region; `out_len` points to a writable
/// `usize`.
#[no_mangle]
pub unsafe extern "C" fn vad_resample(
    in_ptr: *const f32,
    len: usize,
    in_rate: u32,
    out_rate: u32,
    out_len: *mut usize,
) -> *mut f32 {
    let input = core::slice::from_raw_parts(in_ptr, len);
    let mut out = resample_linear(input, in_rate, out_rate);
    let ptr = out.as_mut_ptr();
    let n = out.len();
    core::mem::forget(out); // handed to JS; reclaimed via vp_free_f32(ptr, n)
    *out_len = n;
    ptr
}

/// LTO keep-alive: referenced from `main()` (under `#[cfg(wasm32)]`) so these
/// `#[no_mangle]` exports stay reachable from `_start` in the call graph and
/// fat-LTO won't dead-code-eliminate them before the linker's `--export` flags
/// can place them in the wasm export section. `black_box` is an optimization
/// barrier — the compiler must assume each pointer escapes — so none of the
/// functions can be dropped. This is never actually CALLED on the voice path
/// (we don't run `_start`); it only has to be statically reachable.
#[inline(never)]
pub fn keep_voice_exports() {
    let sinks: [usize; 18] = [
        vp_alloc_f32 as *const () as usize,
        vp_free_f32 as *const () as usize,
        vad_new as *const () as usize,
        vad_free as *const () as usize,
        vad_push_mic as *const () as usize,
        vad_set_speaking as *const () as usize,
        vad_set_thinking as *const () as usize,
        vad_set_barge_in_thinking as *const () as usize,
        vad_set_output_level as *const () as usize,
        vad_state_code as *const () as usize,
        vad_reset as *const () as usize,
        vad_get_last_energy as *const () as usize,
        vad_get_effective_gate as *const () as usize,
        vad_get_noise_floor as *const () as usize,
        vad_get_barge_run as *const () as usize,
        vad_get_last_reason as *const () as usize,
        vad_rms as *const () as usize,
        vad_resample as *const () as usize,
    ];
    core::hint::black_box(&sinks);
}
