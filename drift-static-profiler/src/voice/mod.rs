//! voice — the real-time control/DSP plane, vendored from Volley's `volley-core`.
//!
//! Volley's architecture is **one audio bus, two engines**:
//!   * JavaScript owns the *model plane* (Whisper / Qwen / Kokoro ONNX on WebGPU).
//!   * This module owns the *control plane* — the deterministic, audio-rate logic:
//!     voice-activity detection, utterance segmentation, and the DuplexCascade
//!     micro-turn state machine that decides *when* to listen, think, speak, and
//!     barge-in.
//!
//! It is backend-agnostic on purpose: the exact same code compiles to native
//! (unit-tested here) and into the `drift-static-profiler.wasm` (`wasm32-wasip1`)
//! the extension already ships. Unlike the original `volley-core`, the wasm
//! surface is NOT wasm-bindgen — the extension's wasm is a WASI binary, so the
//! JS-callable surface is a plain C-ABI export layer in the binary crate
//! (`src/voice_wasm.rs`, wasm32-gated). This module stays pure Rust with zero
//! deps so native builds and `cargo test` never touch any glue.

/// Volley runs its audio bus at 24 kHz (matches Kokoro TTS output; the brief
/// 24→16 kHz resample for Whisper happens once per utterance in JS).
pub const SAMPLE_RATE: u32 = 24_000;

/// One analysis frame = 20 ms @ 24 kHz. VAD and the FSM tick at this rate.
pub const RENDER_FRAME: usize = 480;

/// Root-mean-square energy of a PCM frame in `[-1, 1]`.
pub fn rms(frame: &[f32]) -> f32 {
    if frame.is_empty() {
        return 0.0;
    }
    let sum: f32 = frame.iter().map(|x| x * x).sum();
    (sum / frame.len() as f32).sqrt()
}

/// Zero-crossing rate: fraction of adjacent sample pairs whose sign differs (0 treated as positive).
/// Cheap, stateless, O(N) speech-vs-noise cue — voiced speech and low-frequency hum/rumble have LOW
/// ZCR, sustained tones near-zero, while broadband hiss is high. A complement to `rms` for rejecting
/// stationary low-freq noise that clears an energy gate. Provided as a primitive; not yet wired into
/// the FSM (gating it on real audio is a follow-up — see VC-5).
pub fn zero_crossing_rate(frame: &[f32]) -> f32 {
    if frame.len() < 2 {
        return 0.0;
    }
    let mut crossings = 0u32;
    for w in frame.windows(2) {
        if (w[0] < 0.0) != (w[1] < 0.0) {
            crossings += 1;
        }
    }
    crossings as f32 / (frame.len() - 1) as f32
}

/// Linear-interpolation resampler (e.g. the bus's 24 kHz → Whisper's 16 kHz).
/// Cheap and good enough for ASR; the DSP plane can host a polyphase filter later.
pub fn resample_linear(input: &[f32], in_rate: u32, out_rate: u32) -> Vec<f32> {
    if input.is_empty() || in_rate == out_rate {
        return input.to_vec();
    }
    let ratio = out_rate as f64 / in_rate as f64;
    let n = ((input.len() as f64) * ratio).round().max(1.0) as usize;
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / ratio;
        let i0 = t.floor() as usize;
        let frac = (t - i0 as f64) as f32;
        let a = input.get(i0).copied().unwrap_or(0.0);
        let b = input.get(i0 + 1).copied().unwrap_or(a);
        out.push(a + (b - a) * frac);
    }
    out
}

/// The DuplexCascade conversational state.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    /// Waiting for / hearing the user.
    Listening,
    /// User finished; ASR + brain + TTS pipeline is running.
    Thinking,
    /// Agent is speaking (and STILL listening — that's what makes it duplex).
    Speaking,
}

/// The instruction the FSM hands back to the JS worker for a mic frame.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    /// Nothing to do this frame.
    None,
    /// The user just started talking — UI: "listening", begin buffering audio.
    UserStarted,
    /// A complete user utterance ended — run ASR → brain → TTS on the buffer.
    CommitUtterance,
    /// User spoke while the agent was speaking — flush output + abort generation.
    BargeIn,
}

/// Tunable timing for the micro-turn segmenter. All counts are in 20 ms frames.
#[derive(Clone, Debug)]
pub struct Config {
    /// Absolute mic-energy gate. ASSUMES the browser's `autoGainControl` is ON (the Web Audio
    /// default → roughly normalized RMS); with AGC OFF this fixed level is unreliable across
    /// devices — set `floor_margin > 0` to ride the ambient floor (relative gate) instead.
    pub vad_threshold: f32,
    pub vad_hang: u32,
    /// Minimum speech before an utterance counts (rejects coughs/clicks).
    pub min_speech_frames: u32,
    /// Trailing silence that ends an utterance (end-pointing).
    pub end_silence_frames: u32,
    /// Sustained user speech (while agent speaks) that triggers barge-in.
    pub barge_speech_frames: u32,
    /// While the agent speaks, the barge-in energy gate is raised by
    /// `echo_margin * agent_output_level` so our own voice bleeding into the mic
    /// (residual after the browser's echo canceller) doesn't self-trigger.
    pub echo_margin: f32,
    /// Adaptive noise-floor margin. **0 = OFF** (use the fixed `vad_threshold`, today's behavior).
    /// When > 0 the speech-onset threshold becomes `vad_threshold + floor_margin * noise_floor`,
    /// where `noise_floor` tracks ambient energy — so the gate holds a roughly constant margin
    /// ABOVE the room instead of a fixed absolute level (robust across quiet rooms vs. noisy offices).
    pub floor_margin: f32,
}

impl Default for Config {
    fn default() -> Self {
        // SOURCE OF TRUTH: these MUST mirror `DEFAULT_TUNING` in web/src/protocol.mjs — that is what
        // production runs (the worker always passes it via `Engine::withConfig`). This Default only
        // backs the `new Engine()` no-config path and the native unit tests; keeping it in sync stops
        // the two from drifting into divergent "defaults". Counts are 20 ms frames.
        Self {
            vad_threshold: 0.025,   // mic energy gate (speech vs silence)
            vad_hang: 4,            // 80 ms dip tolerance (barge hangover + blip-discard)
            min_speech_frames: 5,   // 100 ms min speech — rejects blips
            end_silence_frames: 30, // 600 ms trailing silence ends a turn
            barge_speech_frames: 5, // 100 ms sustained speech-over-agent triggers barge-in
            echo_margin: 0.6,       // echo-aware barge-in gate strength
            floor_margin: 0.0,      // adaptive noise floor OFF → identical to the fixed threshold
        }
    }
}

/// The always-listening micro-turn state machine. Pure, deterministic, no I/O.
pub struct DuplexFsm {
    cfg: Config,
    state: State,
    speech_frames: u32,
    silence_frames: u32,
    barge_run: u32,
    /// Consecutive sub-gate frames seen *during* a barge attempt. A short dip (≤ `vad_hang`)
    /// is tolerated so inter-syllable gaps don't reset `barge_run`; only a longer gap does.
    barge_quiet: u32,
    output_level: f32,
    /// EMA of ambient (sub-threshold) energy; drives the adaptive onset threshold when
    /// `cfg.floor_margin > 0`. Updated ONLY on sub-threshold Listening frames so speech can't poison it.
    noise_floor: f32,
    /// Whether a sustained burst DURING Thinking supersedes the in-flight turn (barge-in).
    /// `true` (default) = full-duplex while thinking, correct for a near-instant LOCAL brain
    /// where Thinking lasts ~100 ms. A slow REMOTE brain holds the FSM in Thinking long enough
    /// that ordinary mic energy — the user's own trailing speech, breathing, room noise —
    /// repeatedly fires a Thinking-barge and aborts the turn before the reply lands. A worker
    /// can set this `false` for such brains; Speaking-phase barge-in is unaffected.
    barge_in_thinking: bool,
    // --- telemetry (read-only via getters; NEVER affects control flow) ---
    last_energy: f32, // RMS of the most recent frame
    last_gate: f32,   // effective threshold/gate used for the most recent frame
    last_reason: u8,  // why the last non-None action fired: 0=none 1=onset 2=end-silence 3=barge
}

impl DuplexFsm {
    pub fn new(cfg: Config) -> Self {
        Self {
            cfg,
            state: State::Listening,
            speech_frames: 0,
            silence_frames: 0,
            barge_run: 0,
            barge_quiet: 0,
            output_level: 0.0,
            noise_floor: 0.0,
            barge_in_thinking: true, // default preserves the local-brain full-duplex behavior
            last_energy: 0.0,
            last_gate: 0.0,
            last_reason: 0,
        }
    }

    /// Toggle barge-in DURING the Thinking phase (see the field doc). Does not affect
    /// Speaking-phase barge-in. The worker calls this at init based on the brain's latency.
    pub fn set_barge_in_thinking(&mut self, on: bool) {
        self.barge_in_thinking = on;
    }

    pub fn state(&self) -> State {
        self.state
    }

    /// JS reports the RMS of the audio the agent is currently playing, so barge-in
    /// can discount the echo of our own voice. Set to 0 when silent.
    pub fn set_output_level(&mut self, level: f32) {
        self.output_level = level.max(0.0);
    }

    /// Zero all per-utterance / per-frame transient state: segmentation counters, barge
    /// accumulators, the adaptive noise floor, and telemetry. `state` and `output_level` are owned
    /// by each caller (they differ per transition). One place so a new field can't be forgotten in
    /// one reset path and leak across turns.
    fn clear_transient(&mut self) {
        self.speech_frames = 0;
        self.silence_frames = 0;
        self.barge_run = 0;
        self.barge_quiet = 0;
        self.noise_floor = 0.0;
    }

    /// Zero the read-only telemetry. Kept SEPARATE from `clear_transient` because on a commit the
    /// FSM sets `last_reason = 2` and the worker immediately calls `set_thinking()` — if that wiped
    /// telemetry, `last_reason == 2` ("end-silence") would be destroyed before JS could ever read it.
    /// So `set_thinking` clears only the control accumulators and lets the commit reason survive into
    /// Thinking; `set_speaking`/`reset` (turn boundaries) clear telemetry too so it never shows stale.
    fn clear_telemetry(&mut self) {
        self.last_energy = 0.0;
        self.last_gate = 0.0;
        self.last_reason = 0;
    }

    /// JS reports when the agent's TTS actually starts / stops playing.
    pub fn set_speaking(&mut self, speaking: bool) {
        self.state = if speaking {
            State::Speaking
        } else {
            State::Listening
        };
        self.clear_transient();
        self.clear_telemetry();
        if !speaking {
            self.output_level = 0.0;
        }
    }

    /// JS reports when the brain/TTS pipeline starts after a commit. We stay barge-in-capable during
    /// Thinking, so reset the accumulators (no stale Speaking-phase run leaks in); nothing plays, so
    /// the output level is 0. Telemetry is NOT cleared here so the just-set commit reason (last_reason=2)
    /// remains observable through the Thinking phase.
    pub fn set_thinking(&mut self) {
        self.state = State::Thinking;
        self.clear_transient();
        self.output_level = 0.0;
    }

    /// Onset/segmentation threshold. With `floor_margin == 0` this is the fixed `vad_threshold`
    /// (today's behavior, byte-identical). With `floor_margin > 0` it rides the tracked ambient
    /// `noise_floor` so the gate keeps a roughly constant margin above the room.
    ///
    /// INVARIANT (don't "fix" the Thinking/Speaking gate to carry a floor): `noise_floor` is advanced
    /// ONLY by the sub-threshold EMA in the Listening arm of `on_mic_frame`, and both `set_speaking`
    /// and `set_thinking` call `clear_transient` which zeros it. So throughout Thinking — and at
    /// Speaking entry — `noise_floor` is structurally 0 and this reduces to `vad_threshold`. The
    /// Speaking gate deliberately omits the floor entirely (it adds the echo term instead; feeding
    /// echo-laden frames into the EMA would poison it). The asymmetry is intentional, not a bug.
    fn effective_threshold(&self) -> f32 {
        if self.cfg.floor_margin > 0.0 {
            self.cfg.vad_threshold + self.cfg.floor_margin * self.noise_floor
        } else {
            self.cfg.vad_threshold
        }
    }

    /// Sustained-speech-over-`gate` barge-in accumulator, shared by the Speaking and Thinking arms.
    /// Counts above-`gate` frames; tolerates sub-gate dips up to `vad_hang` (the hangover) so
    /// inter-syllable gaps don't reset the run — otherwise a user had to sustain PERFECTLY
    /// consecutive loud frames to interrupt, which was slow/flaky. Echo stays below the gate, so it
    /// never advances the run (self-trigger risk unchanged). On reaching `barge_speech_frames` it
    /// enters Listening counting THIS frame as the new utterance's start (speech_frames=1) and signals
    /// BargeIn — the contract the worker relies on (it must NOT call set_speaking(false) on a barge).
    fn detect_barge(&mut self, e: f32, gate: f32) -> Action {
        if e >= gate {
            self.barge_run += 1;
            self.barge_quiet = 0;
            if self.barge_run >= self.cfg.barge_speech_frames {
                self.barge_run = 0;
                self.barge_quiet = 0;
                self.state = State::Listening;
                self.speech_frames = 1;
                self.silence_frames = 0;
                self.last_reason = 3; // barge
                                      // Pin the worker-facing barge contract at its source (debug builds / tests only —
                                      // debug_assert! compiles out of the release wasm, so zero production cost).
                debug_assert!(
                    self.state == State::Listening && self.speech_frames == 1 && self.barge_run == 0 && self.barge_quiet == 0,
                    "BargeIn contract: must enter Listening mid-utterance with accumulators cleared"
                );
                return Action::BargeIn;
            }
        } else if self.barge_run > 0 {
            self.barge_quiet += 1;
            if self.barge_quiet > self.cfg.vad_hang {
                self.barge_run = 0;
                self.barge_quiet = 0;
            }
        }
        Action::None
    }

    /// Feed one [`RENDER_FRAME`] of mic audio; returns the action JS must take.
    pub fn on_mic_frame(&mut self, frame: &[f32]) -> Action {
        // Invariant: utterance counters are zero outside Listening (clear_transient postcondition).
        // A future edit that leaks speech_frames/silence_frames into Thinking/Speaking trips this in
        // tests/debug; it compiles out of the release wasm (zero production cost).
        debug_assert!(
            self.state == State::Listening || (self.speech_frames == 0 && self.silence_frames == 0),
            "non-Listening states must hold zeroed utterance counters"
        );
        let e = rms(frame);
        self.last_energy = e; // telemetry
        match self.state {
            // Speaking: always listening (that's what makes it duplex). Barge-in uses an echo-aware
            // gate raised by the agent's own output level so its voice doesn't self-interrupt. (The
            // adaptive floor is NOT added here — echo would poison it and the echo term already
            // handles robustness.)
            State::Speaking => {
                let gate = self.cfg.vad_threshold + self.cfg.echo_margin * self.output_level;
                self.last_gate = gate;
                self.detect_barge(e, gate)
            }
            State::Listening => {
                // Onset on the *instantaneous* threshold (a short blip can't be inflated by hangover).
                // The threshold is the adaptive floor when enabled, else the fixed vad_threshold.
                let thr = self.effective_threshold();
                self.last_gate = thr;
                if e >= thr {
                    self.speech_frames += 1;
                    self.silence_frames = 0;
                    if self.speech_frames == 1 {
                        self.last_reason = 1; // onset
                        return Action::UserStarted;
                    }
                    Action::None
                } else {
                    // Sub-threshold frame → track the ambient noise floor (adaptive mode only).
                    // Only non-speech frames feed the EMA, so user speech can't drag the floor up.
                    if self.cfg.floor_margin > 0.0 {
                        self.noise_floor = 0.98 * self.noise_floor + 0.02 * e;
                    }
                    if self.speech_frames > 0 {
                        self.silence_frames += 1;
                        if self.speech_frames >= self.cfg.min_speech_frames {
                            // Real utterance → end-point after sustained silence.
                            if self.silence_frames >= self.cfg.end_silence_frames {
                                self.speech_frames = 0;
                                self.silence_frames = 0;
                                self.state = State::Thinking;
                                self.last_reason = 2; // end-silence
                                return Action::CommitUtterance;
                            }
                        } else if self.silence_frames >= self.cfg.vad_hang {
                            // Sub-threshold blip → discard, never commit.
                            self.speech_frames = 0;
                            self.silence_frames = 0;
                        }
                        Action::None
                    } else {
                        Action::None
                    }
                }
            }
            // Thinking: ASR+brain are running and the agent hasn't started speaking yet. STAY
            // full-duplex — a sustained burst here means the user is correcting/aborting before we
            // reply, so treat it as a barge-in that supersedes the in-flight turn. Nothing is playing,
            // so the gate is the (adaptive) onset threshold — no echo term. On a BargeIn the JS worker
            // aborts the in-flight ASR turn and captures the new utterance — same path as a
            // Speaking-phase barge. (Closes the "deaf while Thinking" gap.)
            State::Thinking => {
                let gate = self.effective_threshold();
                self.last_gate = gate;
                // Only barge during Thinking when enabled (local/instant brains). For a slow remote
                // brain this is off, so a long think-wait can't be aborted by ambient mic energy —
                // the reply is allowed to land. Speaking-phase barge-in is unaffected.
                if self.barge_in_thinking {
                    self.detect_barge(e, gate)
                } else {
                    Action::None
                }
            }
        }
    }

    pub fn reset(&mut self) {
        self.state = State::Listening;
        self.clear_transient();
        self.clear_telemetry(); // turn boundary → no stale reason/energy/gate
        self.output_level = 0.0; // reset is fully idempotent (parity with set_speaking(false))
    }

    // --- read-only telemetry getters (no control-flow effect; for UI/tuning/debugging) ---
    pub fn last_energy(&self) -> f32 {
        self.last_energy
    }
    /// The effective threshold/gate used on the most recent frame (incorporates the echo term while
    /// Speaking and the adaptive floor when enabled).
    pub fn effective_gate(&self) -> f32 {
        self.last_gate
    }
    pub fn noise_floor(&self) -> f32 {
        self.noise_floor
    }
    pub fn barge_run(&self) -> u32 {
        self.barge_run
    }
    /// Why the last non-None action fired: 0=none 1=onset 2=end-silence 3=barge.
    pub fn last_reason(&self) -> u8 {
        self.last_reason
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(level: f32) -> Vec<f32> {
        // A constant-|level| frame has RMS == level.
        vec![level; RENDER_FRAME]
    }

    #[test]
    fn rms_of_constant_is_level() {
        assert!((rms(&frame(0.5)) - 0.5).abs() < 1e-6);
        assert_eq!(rms(&[]), 0.0);
    }

    #[test]
    fn barge_hangover_boundary_tolerate_then_reset() {
        let cfg = Config::default();
        let mut fsm = DuplexFsm::new(cfg.clone());
        fsm.set_speaking(true);
        let loud = frame(0.3);
        let quiet = frame(0.0);
        for _ in 0..(cfg.barge_speech_frames - 1) {
            assert_eq!(fsm.on_mic_frame(&loud), Action::None);
        }
        let run_before = fsm.barge_run();
        assert!(run_before > 0);
        for _ in 0..cfg.vad_hang {
            assert_eq!(fsm.on_mic_frame(&quiet), Action::None);
        }
        assert_eq!(
            fsm.barge_run(),
            run_before,
            "dips up to vad_hang must preserve the barge run"
        );
        assert_eq!(fsm.on_mic_frame(&quiet), Action::None);
        assert_eq!(
            fsm.barge_run(),
            0,
            "a dip longer than vad_hang resets the barge run"
        );
    }

    #[test]
    fn commit_reason_survives_set_thinking() {
        let cfg = Config::default();
        let mut fsm = DuplexFsm::new(cfg.clone());
        let loud = frame(0.2);
        let quiet = frame(0.0);
        assert_eq!(fsm.on_mic_frame(&loud), Action::UserStarted);
        for _ in 0..cfg.min_speech_frames {
            fsm.on_mic_frame(&loud);
        }
        let mut committed = false;
        for _ in 0..(cfg.end_silence_frames + 5) {
            if fsm.on_mic_frame(&quiet) == Action::CommitUtterance {
                committed = true;
                break;
            }
        }
        assert!(committed);
        assert_eq!(fsm.last_reason(), 2, "commit set end-silence reason");
        fsm.set_thinking();
        assert_eq!(
            fsm.last_reason(),
            2,
            "commit reason must survive set_thinking (observable by JS)"
        );
        fsm.reset();
        assert_eq!(fsm.last_reason(), 0, "reset clears the reason");
    }

    #[test]
    fn utterance_commits_after_end_silence() {
        let mut fsm = DuplexFsm::new(Config::default());
        let loud = frame(0.2);
        let quiet = frame(0.0);
        assert_eq!(fsm.on_mic_frame(&loud), Action::UserStarted);
        assert_eq!(fsm.state(), State::Listening);
        for _ in 0..10 {
            assert_eq!(fsm.on_mic_frame(&loud), Action::None);
        }
        let mut committed = false;
        for _ in 0..60 {
            if fsm.on_mic_frame(&quiet) == Action::CommitUtterance {
                committed = true;
                break;
            }
        }
        assert!(committed, "utterance should commit after end silence");
        assert_eq!(fsm.state(), State::Thinking);
    }

    #[test]
    fn barge_in_while_speaking() {
        let mut fsm = DuplexFsm::new(Config::default());
        fsm.set_speaking(true);
        assert_eq!(fsm.state(), State::Speaking);
        let loud = frame(0.3);
        let mut barged = false;
        for _ in 0..Config::default().barge_speech_frames {
            if fsm.on_mic_frame(&loud) == Action::BargeIn {
                barged = true;
            }
        }
        assert!(barged, "sustained speech should barge in");
        assert_eq!(fsm.state(), State::Listening);
    }

    #[test]
    fn barge_in_continues_as_one_utterance_without_restart() {
        let mut fsm = DuplexFsm::new(Config::default());
        fsm.set_speaking(true);
        let loud = frame(0.3);
        let mut barged = false;
        for _ in 0..Config::default().barge_speech_frames {
            if fsm.on_mic_frame(&loud) == Action::BargeIn {
                barged = true;
            }
        }
        assert!(barged, "sustained speech should barge in");
        assert_eq!(fsm.state(), State::Listening);
        for _ in 0..10 {
            assert_eq!(fsm.on_mic_frame(&loud), Action::None);
        }
        let quiet = frame(0.0);
        let mut committed = false;
        for _ in 0..80 {
            if fsm.on_mic_frame(&quiet) == Action::CommitUtterance {
                committed = true;
                break;
            }
        }
        assert!(committed, "barge-in utterance should commit after end silence");
        assert_eq!(fsm.state(), State::Thinking);
    }

    #[test]
    fn barge_in_tolerates_brief_dips() {
        let cfg = Config::default();
        let mut fsm = DuplexFsm::new(cfg.clone());
        fsm.set_speaking(true);
        let loud = frame(0.3);
        let quiet = frame(0.0);
        let mut barged = false;
        for _ in 0..cfg.barge_speech_frames {
            if fsm.on_mic_frame(&loud) == Action::BargeIn {
                barged = true;
                break;
            }
            let _ = fsm.on_mic_frame(&quiet); // one-frame dip (≤ vad_hang) — tolerated, not a reset
        }
        assert!(
            barged,
            "loud speech with brief inter-syllable dips should still barge in"
        );
        assert_eq!(fsm.state(), State::Listening);
    }

    #[test]
    fn barge_run_resets_after_long_gap() {
        let cfg = Config::default();
        let mut fsm = DuplexFsm::new(cfg.clone());
        fsm.set_speaking(true);
        let loud = frame(0.3);
        let quiet = frame(0.0);
        for _ in 0..(cfg.barge_speech_frames - 1) {
            assert_eq!(fsm.on_mic_frame(&loud), Action::None);
        }
        for _ in 0..(cfg.vad_hang + 1) {
            assert_eq!(fsm.on_mic_frame(&quiet), Action::None);
        }
        for _ in 0..(cfg.barge_speech_frames - 1) {
            assert_eq!(fsm.on_mic_frame(&loud), Action::None);
        }
        assert_eq!(fsm.on_mic_frame(&loud), Action::BargeIn);
    }

    #[test]
    fn thinking_phase_barge_enters_listening_with_one_utterance() {
        let cfg = Config::default();
        let mut fsm = DuplexFsm::new(cfg.clone());
        fsm.set_thinking();
        assert_eq!(fsm.state(), State::Thinking);
        let loud = frame(0.2);
        let mut barged = false;
        for _ in 0..cfg.barge_speech_frames {
            if fsm.on_mic_frame(&loud) == Action::BargeIn {
                barged = true;
                break;
            }
        }
        assert!(barged, "sustained speech during Thinking should barge in");
        assert_eq!(fsm.state(), State::Listening);
        for _ in 0..10 {
            assert_eq!(fsm.on_mic_frame(&loud), Action::None);
        }
        let quiet = frame(0.0);
        let mut committed = false;
        for _ in 0..80 {
            if fsm.on_mic_frame(&quiet) == Action::CommitUtterance {
                committed = true;
                break;
            }
        }
        assert!(
            committed,
            "barge-during-thinking utterance should commit after end silence"
        );
        assert_eq!(fsm.state(), State::Thinking);
    }

    #[test]
    fn thinking_barge_disabled_never_supersedes() {
        let cfg = Config::default();
        let mut fsm = DuplexFsm::new(cfg.clone());
        fsm.set_barge_in_thinking(false);
        fsm.set_thinking();
        assert_eq!(fsm.state(), State::Thinking);
        let loud = frame(0.2);
        for _ in 0..(cfg.barge_speech_frames * 4) {
            assert_eq!(
                fsm.on_mic_frame(&loud),
                Action::None,
                "Thinking-barge disabled: sustained speech must NOT supersede the turn"
            );
            assert_eq!(fsm.state(), State::Thinking, "must stay in Thinking");
        }
        fsm.set_barge_in_thinking(true);
        let mut barged = false;
        for _ in 0..cfg.barge_speech_frames {
            if fsm.on_mic_frame(&loud) == Action::BargeIn {
                barged = true;
                break;
            }
        }
        assert!(barged, "re-enabling barge_in_thinking restores Thinking-phase barge");
    }

    #[test]
    fn thinking_brief_noise_does_not_barge() {
        let cfg = Config::default();
        let mut fsm = DuplexFsm::new(cfg.clone());
        fsm.set_thinking();
        let loud = frame(0.2);
        let quiet = frame(0.0);
        for _ in 0..(cfg.barge_speech_frames - 1) {
            assert_eq!(fsm.on_mic_frame(&loud), Action::None);
        }
        for _ in 0..20 {
            assert_ne!(fsm.on_mic_frame(&quiet), Action::BargeIn);
        }
        assert_eq!(fsm.state(), State::Thinking);
    }

    #[test]
    fn zero_crossing_rate_basics() {
        assert_eq!(zero_crossing_rate(&frame(0.2)), 0.0);
        assert_eq!(zero_crossing_rate(&[]), 0.0);
        let alt: Vec<f32> = (0..RENDER_FRAME)
            .map(|i| if i % 2 == 0 { 0.2 } else { -0.2 })
            .collect();
        assert!((zero_crossing_rate(&alt) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn reset_clears_output_level() {
        let mut fsm = DuplexFsm::new(Config::default());
        fsm.set_speaking(true);
        fsm.set_output_level(0.5);
        fsm.reset();
        fsm.set_speaking(true);
        let loud = frame(0.1);
        let mut barged = false;
        for _ in 0..Config::default().barge_speech_frames {
            if fsm.on_mic_frame(&loud) == Action::BargeIn {
                barged = true;
                break;
            }
        }
        assert!(
            barged,
            "after reset, output_level must be 0 so the base gate lets a 0.1 burst barge in"
        );
    }

    #[test]
    fn adaptive_floor_raises_onset_threshold_in_noise() {
        let mut cfg = Config::default();
        cfg.floor_margin = 4.0;
        let mut fsm = DuplexFsm::new(cfg);
        let bed = frame(0.012);
        let spike = frame(0.04);
        for _ in 0..300 {
            assert_eq!(fsm.on_mic_frame(&bed), Action::None);
        }
        assert!(
            fsm.effective_gate() > 0.04,
            "adaptive floor should lift the gate above the transient"
        );
        assert_eq!(fsm.on_mic_frame(&spike), Action::None);
        assert_eq!(fsm.state(), State::Listening);

        let mut off = DuplexFsm::new(Config::default());
        assert_eq!(off.on_mic_frame(&spike), Action::UserStarted);
    }

    #[test]
    fn brief_blip_does_not_commit() {
        let mut fsm = DuplexFsm::new(Config::default());
        let loud = frame(0.2);
        let quiet = frame(0.0);
        assert_eq!(fsm.on_mic_frame(&loud), Action::UserStarted);
        fsm.on_mic_frame(&loud);
        for _ in 0..40 {
            assert_ne!(fsm.on_mic_frame(&quiet), Action::CommitUtterance);
        }
    }

    #[test]
    fn echo_does_not_self_interrupt_but_user_can() {
        let mut fsm = DuplexFsm::new(Config::default());
        fsm.set_speaking(true);
        fsm.set_output_level(0.2);
        for _ in 0..20 {
            assert_eq!(fsm.on_mic_frame(&frame(0.1)), Action::None);
        }
        assert_eq!(fsm.state(), State::Speaking);
        let mut barged = false;
        for _ in 0..Config::default().barge_speech_frames {
            if fsm.on_mic_frame(&frame(0.3)) == Action::BargeIn {
                barged = true;
            }
        }
        assert!(barged, "user louder than the echo gate should barge in");
        assert_eq!(fsm.state(), State::Listening);
    }

    #[test]
    fn resample_interpolates_and_scales_length() {
        let x = [0.0f32, 1.0, 2.0, 3.0];
        let down = resample_linear(&x, 2, 1);
        assert_eq!(down.len(), 2);
        assert!((down[0] - 0.0).abs() < 1e-6);
        assert!((down[1] - 2.0).abs() < 1e-6);
        assert_eq!(resample_linear(&x, 16000, 16000), x.to_vec());
        assert_eq!(resample_linear(&x, 1, 2).len(), 8);
        assert!(resample_linear(&[], 24000, 16000).is_empty());
    }
}
