#!/usr/bin/env bash
# tts-local.sh — generate a spoken-summary WAV locally with the SAME engine
# the Drift Action uses (Kokoro via the self-contained sherpa-onnx binary),
# then open a tiny HTML player in the browser so you can listen.
#
# This is a developer-preview mirror of action.yml step 8d. It downloads +
# caches the sherpa-onnx binary and the Kokoro model once (SHA256-verified
# against the same pins the action ships), then synthesizes and plays.
#
# Env knobs (all optional):
#   TEXT="..."        — text to speak (takes precedence)
#   TEXT_FILE=path    — read text from a file
#   WORDS=N           — if no TEXT/TEXT_FILE, auto-generate an N-word briefing
#   VOICE=af_heart    — Kokoro voice name (af_heart, am_michael, af_bella, …)
#   OUT_DIR=path      — where the .wav + player.html land (default: tmp/tts)
#   NO_OPEN=1         — synthesize only; do not open the browser
#   FETCH_ONLY=1      — download + cache the binary and model, then exit
#                       (used by `make audio-deps` to pre-install everything)
#
# No Python, no npm — just curl + tar + the prebuilt binary.
set -euo pipefail

# ─── pins (kept in lockstep with action.yml) ──────────────────────────────
SHERPA_VERSION="v1.13.2"
# fp32 v1.0 — matches action.yml's kokoro-model default (full precision, ~333 MB).
# For the smaller int8 build use kokoro-int8-multi-lang-v1_0 +
# 75654a84864be26f345f020f4070c2c019e96dd1b7f9bf6e2ffd59efac6aa5a3.
KOKORO_MODEL="kokoro-multi-lang-v1_0"
KOKORO_MODEL_SHA256="c133d26353d776da730870dac7da07dbfc9a5e3bc80cc5e8e83ab6e823be7046"
SHA_LINUX_X64="1ef6741535f7af4d69e394fd440a807108036d26ed4f542660191019da5c0daa"
SHA_LINUX_AARCH64="b54178420e9e6ff6c7f308b5f1cde827215b38393356ee0bd2b7595c648b330b"

VOICE="${VOICE:-af_heart}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/tmp/tts}"
CACHE="${TMPDIR:-/tmp}/drift-tts-cache"
SHERPA_DIR="$CACHE/sherpa-$SHERPA_VERSION"
KOKORO_DIR="$CACHE/$KOKORO_MODEL"
mkdir -p "$OUT_DIR" "$CACHE"

c() { printf '\033[1;%sm%s\033[0m\n' "$1" "$2"; }   # color helper: c 36 "msg"

# ─── resolve OS/arch → sherpa asset + the right loader-path env var ────────
os="$(uname -s)"; arch="$(uname -m)"
case "$os-$arch" in
  Darwin-arm64)         asset="osx-arm64-shared";        exp_sha=""                 ; LIBVAR="DYLD_LIBRARY_PATH" ;;
  Linux-x86_64)         asset="linux-x64-shared";        exp_sha="$SHA_LINUX_X64"   ; LIBVAR="LD_LIBRARY_PATH" ;;
  Linux-aarch64)        asset="linux-aarch64-shared-cpu"; exp_sha="$SHA_LINUX_AARCH64"; LIBVAR="LD_LIBRARY_PATH" ;;
  *) c 31 "✗ unsupported platform $os-$arch (supported: Darwin-arm64, Linux-x86_64, Linux-aarch64)"; exit 1 ;;
esac

verify_sha() { # file expected_sha label
  [ -z "$2" ] && { c 33 "ℹ $3: no pinned SHA for this platform — skipping verify (local preview)"; return 0; }
  command -v sha256sum >/dev/null 2>&1 || { local s; s="$(shasum -a 256 "$1" | awk '{print $1}')"; [ "$s" = "$2" ] && { c 32 "🔒 $3 SHA256 ok"; return 0; }; c 31 "✗ $3 SHA256 mismatch"; return 1; }
  local s; s="$(sha256sum "$1" | awk '{print $1}')"; [ "$s" = "$2" ] && { c 32 "🔒 $3 SHA256 ok"; return 0; }; c 31 "✗ $3 SHA256 mismatch (got $s)"; return 1
}

# ─── download + cache the binary (once) ────────────────────────────────────
bin="$SHERPA_DIR/bin/sherpa-onnx-offline-tts"
if [ ! -x "$bin" ]; then
  url="https://github.com/k2-fsa/sherpa-onnx/releases/download/$SHERPA_VERSION/sherpa-onnx-$SHERPA_VERSION-$asset.tar.bz2"
  c 34 "▶ downloading sherpa-onnx ($asset)…"
  curl -fSL --connect-timeout 10 --max-time 300 -o "$CACHE/sherpa.tar.bz2" "$url"
  verify_sha "$CACHE/sherpa.tar.bz2" "$exp_sha" "sherpa-onnx"
  mkdir -p "$SHERPA_DIR"; tar -xjf "$CACHE/sherpa.tar.bz2" -C "$SHERPA_DIR" --strip-components=1; rm -f "$CACHE/sherpa.tar.bz2"
fi

# ─── download + cache the Kokoro model (once) ──────────────────────────────
if [ ! -f "$KOKORO_DIR/model.int8.onnx" ] && [ ! -f "$KOKORO_DIR/model.onnx" ]; then
  url="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$KOKORO_MODEL.tar.bz2"
  c 34 "▶ downloading Kokoro model ($KOKORO_MODEL, ~126 MB)…"
  curl -fSL --connect-timeout 10 --max-time 600 -o "$CACHE/kokoro.tar.bz2" "$url"
  verify_sha "$CACHE/kokoro.tar.bz2" "$KOKORO_MODEL_SHA256" "kokoro model"
  mkdir -p "$KOKORO_DIR"; tar -xjf "$CACHE/kokoro.tar.bz2" -C "$KOKORO_DIR" --strip-components=1; rm -f "$CACHE/kokoro.tar.bz2"
fi

if [ "${FETCH_ONLY:-0}" = "1" ]; then
  c 32 "✓ deps ready — binary: $bin"
  c 32 "✓ deps ready — model:  $KOKORO_DIR"
  exit 0
fi

# ─── resolve the text ──────────────────────────────────────────────────────
if [ -n "${TEXT:-}" ]; then
  text="$TEXT"
elif [ -n "${TEXT_FILE:-}" ]; then
  text="$(cat "$TEXT_FILE")"
elif [ -n "${WORDS:-}" ]; then
  text="$(WORDS="$WORDS" node "$(dirname "${BASH_SOURCE[0]}")/tts-sample-briefing.mjs")"
  c 36 "ℹ generated a ${WORDS}-word sample briefing"
else
  text="In this pull request we replaced the piper engine with kokoro, running the same onnx model through a self contained binary. The af heart voice now speaks the drift summary."
fi

# ─── voice name → speaker id (kokoro-multi-lang-v1_0 catalog) ──────────────
case "$VOICE" in
  af_alloy) SID=0;; af_aoede) SID=1;; af_bella) SID=2;; af_heart) SID=3;;
  af_jessica) SID=4;; af_kore) SID=5;; af_nicole) SID=6;; af_nova) SID=7;;
  af_river) SID=8;; af_sarah) SID=9;; af_sky) SID=10;; am_adam) SID=11;;
  am_echo) SID=12;; am_eric) SID=13;; am_fenrir) SID=14;; am_liam) SID=15;;
  am_michael) SID=16;; am_onyx) SID=17;; am_puck) SID=18;; am_santa) SID=19;;
  bf_alice) SID=20;; bf_emma) SID=21;; bf_isabella) SID=22;; bf_lily) SID=23;;
  bm_daniel) SID=24;; bm_fable) SID=25;; bm_george) SID=26;; bm_lewis) SID=27;;
  *) c 33 "ℹ unknown voice '$VOICE' — falling back to af_heart (sid 3)"; VOICE=af_heart; SID=3;;
esac

# ─── resolve model + (multi-lang) lexicon ──────────────────────────────────
if [ -f "$KOKORO_DIR/model.int8.onnx" ]; then model="$KOKORO_DIR/model.int8.onnx"; else model="$KOKORO_DIR/model.onnx"; fi
lex_files=""
for lf in lexicon-us-en.txt lexicon-zh.txt; do
  [ -f "$KOKORO_DIR/$lf" ] && lex_files="${lex_files:+$lex_files,}$KOKORO_DIR/$lf"
done
lex_flag=(); [ -n "$lex_files" ] && lex_flag=(--kokoro-lexicon="$lex_files")

# ─── synthesize ────────────────────────────────────────────────────────────
wav="$OUT_DIR/drift-summary-$VOICE.wav"
words="$(printf '%s' "$text" | wc -w | tr -d ' ')"; chars="$(printf '%s' "$text" | wc -c | tr -d ' ')"
c 34 "▶ synthesizing ${words} words / ${chars} chars — voice $VOICE (sid $SID) → $wav"
export "$LIBVAR"="$SHERPA_DIR/lib:${!LIBVAR:-}"
synth_log="$OUT_DIR/.synth.log"
"$bin" \
  --kokoro-model="$model" \
  --kokoro-voices="$KOKORO_DIR/voices.bin" \
  --kokoro-tokens="$KOKORO_DIR/tokens.txt" \
  --kokoro-data-dir="$KOKORO_DIR/espeak-ng-data" \
  "${lex_flag[@]}" \
  --num-threads=2 \
  --sid="$SID" \
  --output-filename="$wav" \
  "$text" 2>&1 | tee "$synth_log" | grep -E "Audio duration|Real-time factor" | sed 's/^/  /' || true

[ -s "$wav" ] || { c 31 "✗ synthesis produced no WAV — see $synth_log"; exit 1; }
bytes="$(wc -c < "$wav" | tr -d ' ')"
dur="$(grep -oE 'Audio duration: [0-9.]+' "$synth_log" | grep -oE '[0-9.]+' | head -1 || echo '?')"
c 32 "✓ wrote $wav (${bytes} bytes, ${dur}s, 24 kHz mono)"

# ─── write an HTML player + open it ────────────────────────────────────────
player="$OUT_DIR/player.html"
wav_name="$(basename "$wav")"
{
  printf '<!doctype html><meta charset="utf-8"><title>Drift spoken summary — %s</title>\n' "$VOICE"
  printf '<body style="font:16px system-ui;max-width:680px;margin:48px auto;padding:0 16px;color:#111">\n'
  printf '<h2>🔊 Drift spoken summary <small style="color:#888">(Kokoro · %s · sid %s)</small></h2>\n' "$VOICE" "$SID"
  printf '<audio controls autoplay preload="auto" style="width:100%%" src="%s"></audio>\n' "$wav_name"
  printf '<p style="color:#555">%s words · %s chars · %ss audio · 24 kHz mono WAV</p>\n' "$words" "$chars" "$dur"
  printf '<details><summary style="cursor:pointer;color:#06c">spoken text</summary><pre style="white-space:pre-wrap;background:#f6f8fa;padding:12px;border-radius:8px">%s</pre></details>\n' "$(printf '%s' "$text" | sed 's/&/\&amp;/g; s/</\&lt;/g')"
  printf '</body>\n'
} > "$player"

if [ "${NO_OPEN:-0}" != "1" ]; then
  if command -v open >/dev/null 2>&1; then open "$player"          # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$player" # Linux
  else c 33 "ℹ open the player manually: file://$player"; fi
  c 36 "▶ opened browser player: $player"
else
  c 36 "ℹ player.html written (NO_OPEN=1): $player"
fi
