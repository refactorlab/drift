//! wasm-bindgen surface for the browser worker. Gated to wasm32 so native
//! builds and `cargo test` never depend on JS glue.
//!
//! The boundary is intentionally tiny: JS hands us 20 ms mic frames and gets
//! back a single integer action code. Model tensors NEVER cross this boundary —
//! they stay inside ONNX Runtime on the GPU.

use crate::{Action, Config, DuplexFsm, State, RENDER_FRAME, SAMPLE_RATE};
use wasm_bindgen::prelude::*;

/// Action codes returned by [`Engine::push_mic`] (kept in sync with `protocol.mjs`).
pub const ACT_NONE: u32 = 0;
pub const ACT_USER_STARTED: u32 = 1;
pub const ACT_COMMIT: u32 = 2;
pub const ACT_BARGE_IN: u32 = 3;

/// The control engine that lives in the audio worker.
#[wasm_bindgen]
pub struct Engine {
    fsm: DuplexFsm,
}

#[wasm_bindgen]
impl Engine {
    /// Construct with default DuplexCascade timing.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Engine {
        Engine {
            fsm: DuplexFsm::new(Config::default()),
        }
    }

    /// Construct with explicit timing (all counts in 20 ms frames).
    #[wasm_bindgen(js_name = withConfig)]
    #[allow(clippy::too_many_arguments)]
    pub fn with_config(
        vad_threshold: f32,
        vad_hang: u32,
        min_speech_frames: u32,
        end_silence_frames: u32,
        barge_speech_frames: u32,
        echo_margin: f32,
        floor_margin: f32, // 0 = adaptive noise floor OFF (fixed vad_threshold) — APPEND new args, never reorder
    ) -> Engine {
        Engine {
            fsm: DuplexFsm::new(Config {
                vad_threshold,
                vad_hang,
                min_speech_frames,
                end_silence_frames,
                barge_speech_frames,
                echo_margin,
                floor_margin,
            }),
        }
    }

    /// Samples per analysis frame (20 ms @ 24 kHz = 480).
    #[wasm_bindgen(js_name = frameSize)]
    pub fn frame_size(&self) -> usize {
        RENDER_FRAME
    }

    /// Audio bus sample rate (24 000).
    #[wasm_bindgen(js_name = sampleRate)]
    pub fn sample_rate(&self) -> u32 {
        SAMPLE_RATE
    }

    /// Feed one mic frame; returns 0=none, 1=user-started, 2=commit, 3=barge-in.
    #[wasm_bindgen(js_name = pushMic)]
    pub fn push_mic(&mut self, frame: &[f32]) -> u32 {
        match self.fsm.on_mic_frame(frame) {
            Action::None => ACT_NONE,
            Action::UserStarted => ACT_USER_STARTED,
            Action::CommitUtterance => ACT_COMMIT,
            Action::BargeIn => ACT_BARGE_IN,
        }
    }

    /// JS reports the agent's TTS started / stopped playing.
    #[wasm_bindgen(js_name = setSpeaking)]
    pub fn set_speaking(&mut self, speaking: bool) {
        self.fsm.set_speaking(speaking);
    }

    /// JS reports the brain/TTS pipeline started after a commit.
    #[wasm_bindgen(js_name = setThinking)]
    pub fn set_thinking(&mut self) {
        self.fsm.set_thinking();
    }

    /// Enable/disable barge-in DURING Thinking. Worker sets this `false` for slow remote brains
    /// (e.g. the Claude CLI bridge) so a multi-second think-wait isn't aborted by ambient mic
    /// energy; `true` (default) keeps full-duplex for near-instant local brains. Speaking-phase
    /// barge-in is unaffected either way.
    #[wasm_bindgen(js_name = setBargeInThinking)]
    pub fn set_barge_in_thinking(&mut self, on: bool) {
        self.fsm.set_barge_in_thinking(on);
    }

    /// JS reports the RMS of the audio the agent is currently playing (for the
    /// echo-aware barge-in gate). Set 0 when silent.
    #[wasm_bindgen(js_name = setOutputLevel)]
    pub fn set_output_level(&mut self, level: f32) {
        self.fsm.set_output_level(level);
    }

    /// Current state: 0=listening, 1=thinking, 2=speaking.
    #[wasm_bindgen(js_name = stateCode)]
    pub fn state_code(&self) -> u32 {
        match self.fsm.state() {
            State::Listening => 0,
            State::Thinking => 1,
            State::Speaking => 2,
        }
    }

    pub fn reset(&mut self) {
        self.fsm.reset();
    }

    // --- read-only telemetry (no effect on control flow; for UI VAD viz, empirical tuning, and
    // "why did/didn't it fire" debugging). pushMic's 0/1/2/3 contract is unchanged. ---

    /// RMS energy of the most recent mic frame.
    #[wasm_bindgen(js_name = getLastEnergy)]
    pub fn get_last_energy(&self) -> f32 {
        self.fsm.last_energy()
    }

    /// The effective threshold/gate used on the most recent frame (includes the echo term while
    /// Speaking and the adaptive noise floor when enabled).
    #[wasm_bindgen(js_name = getEffectiveGate)]
    pub fn get_effective_gate(&self) -> f32 {
        self.fsm.effective_gate()
    }

    /// Current adaptive noise-floor estimate (0 unless floor_margin > 0).
    #[wasm_bindgen(js_name = getNoiseFloor)]
    pub fn get_noise_floor(&self) -> f32 {
        self.fsm.noise_floor()
    }

    /// Frames accumulated toward a barge-in (0..barge_speech_frames) — barge "progress".
    #[wasm_bindgen(js_name = getBargeRun)]
    pub fn get_barge_run(&self) -> u32 {
        self.fsm.barge_run()
    }

    /// Why the last non-None action fired: 0=none 1=onset 2=end-silence 3=barge.
    #[wasm_bindgen(js_name = getLastReason)]
    pub fn get_last_reason(&self) -> u8 {
        self.fsm.last_reason()
    }
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

/// RMS energy helper (the JS worker uses it to report the agent's output level).
#[wasm_bindgen(js_name = rmsEnergy)]
pub fn rms_energy(frame: &[f32]) -> f32 {
    crate::rms(frame)
}

/// Resample a PCM frame between rates (the worker uses 24 kHz → 16 kHz for Whisper).
#[wasm_bindgen(js_name = resample)]
pub fn resample(frame: &[f32], in_rate: u32, out_rate: u32) -> Vec<f32> {
    crate::resample_linear(frame, in_rate, out_rate)
}
