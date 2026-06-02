#!/usr/bin/env bash
# Stage the in-tab Kokoro TTS engine into public/kokoro/ so the live scan can
# synthesize its spoken summary locally with the SAME engine the GitHub Action
# uses (sherpa-onnx + the kokoro-multi-lang model). This is the audio
# counterpart of build-wasm.sh: the product is large and gitignored, so it is
# built/staged out-of-band and simply absent in a fresh checkout (the extension
# then fails soft to the browser's system voice).
#
# What it produces under public/kokoro/:
#   sherpa-onnx-wasm-main-tts.js     ← emscripten glue (MUST be bundled; MV3
#   sherpa-onnx-wasm-main-tts.wasm     forbids executing remote script)
#   sherpa-onnx-wasm-main-tts.data     (preloaded model FS image, if present)
#   model.onnx | model.int8.onnx     ← Kokoro acoustic model
#   voices.bin tokens.txt            ← speaker embeddings + token table
#   espeak-ng-data/                  ← eSpeak-NG phonemizer data
#   lexicon-us-en.txt lexicon-zh.txt ← multi-lang lexicons
#   kokoro.meta.json                 ← { version, bytes } the extension reads
#
# Sources (pin versions to match action.yml's sherpa-onnx-version / kokoro-model):
#   sherpa-onnx WASM TTS build:  https://github.com/k2-fsa/sherpa-onnx/releases
#   kokoro-multi-lang-v1_0 model: https://github.com/k2-fsa/sherpa-onnx/releases
#
# Usage:
#   SHERPA_WASM_TARBALL=… KOKORO_MODEL_TARBALL=… bash scripts/build-tts.sh
# or point at an already-unpacked dir:
#   TTS_SRC_DIR=/path/to/staged bash scripts/build-tts.sh
set -euo pipefail

# Keep this in lockstep with action.yml's pinned Kokoro model so the extension
# and the action speak with the same voices.
KOKORO_VERSION="${KOKORO_VERSION:-kokoro-int8-multi-lang-v1_0}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HERE/public/kokoro"
mkdir -p "$DEST"

stage_from_dir() {
  local src="$1"
  echo "→ staging Kokoro engine from $src"
  # Copy only the files the runtime needs; tolerate either int8 or fp32 model.
  for f in \
    sherpa-onnx-wasm-main-tts.js \
    sherpa-onnx-wasm-main-tts.wasm \
    sherpa-onnx-wasm-main-tts.data \
    model.onnx model.int8.onnx voices.bin tokens.txt \
    lexicon-us-en.txt lexicon-zh.txt; do
    [ -f "$src/$f" ] && cp "$src/$f" "$DEST/$f"
  done
  [ -d "$src/espeak-ng-data" ] && cp -R "$src/espeak-ng-data" "$DEST/espeak-ng-data"
}

# Fetch a URL-or-local tarball into $1 and extract it into dir $2.
fetch_and_extract() {
  local src="$1" dest="$2" tarball
  mkdir -p "$dest"
  case "$src" in
    http://*|https://*)
      tarball="$(mktemp -t tts-src.XXXXXX)"
      echo "→ downloading $src"
      curl -fL --retry 3 -o "$tarball" "$src"
      ;;
    *)
      [ -f "$src" ] || { echo "error: $src not found" >&2; exit 1; }
      tarball="$src"
      ;;
  esac
  echo "→ extracting into $dest"
  case "$tarball" in
    *.tar.bz2|*.tbz2) tar -xjf "$tarball" -C "$dest" --strip-components=1 ;;
    *.tar.gz|*.tgz)   tar -xzf "$tarball" -C "$dest" --strip-components=1 ;;
    *.tar)            tar -xf  "$tarball" -C "$dest" --strip-components=1 ;;
    *.zip)            (cd "$dest" && unzip -oq "$tarball") ;;
    *) echo "error: unknown archive type: $tarball" >&2; exit 1 ;;
  esac
}

if [ -n "${TTS_SRC_DIR:-}" ]; then
  # Already-unpacked sherpa-onnx WASM TTS + Kokoro model dir.
  stage_from_dir "$TTS_SRC_DIR"
elif [ -n "${SHERPA_WASM_TARBALL:-}" ] || [ -n "${KOKORO_MODEL_TARBALL:-}" ]; then
  # Turnkey: download/extract the engine bundle and the model, merge, stage.
  WORK="$(mktemp -d -t tts-stage.XXXXXX)"
  trap 'rm -rf "$WORK"' EXIT
  [ -n "${SHERPA_WASM_TARBALL:-}" ] && fetch_and_extract "$SHERPA_WASM_TARBALL" "$WORK"
  [ -n "${KOKORO_MODEL_TARBALL:-}" ] && fetch_and_extract "$KOKORO_MODEL_TARBALL" "$WORK"
  stage_from_dir "$WORK"
else
  echo "error: provide ONE of:" >&2
  echo "  TTS_SRC_DIR=/path/to/unpacked        (sherpa-onnx wasm tts + kokoro model)" >&2
  echo "  SHERPA_WASM_TARBALL=<url|file> KOKORO_MODEL_TARBALL=<url|file>" >&2
  echo "" >&2
  echo "Upstream releases (pin to match action.yml):" >&2
  echo "  sherpa-onnx wasm TTS : https://github.com/k2-fsa/sherpa-onnx/releases" >&2
  echo "  kokoro model         : https://github.com/k2-fsa/sherpa-onnx/releases (kokoro-int8-multi-lang-v1_0)" >&2
  exit 1
fi

# Sanity: the glue is the one file that MUST be present for the engine to load.
if [ ! -f "$DEST/sherpa-onnx-wasm-main-tts.js" ]; then
  echo "error: sherpa-onnx-wasm-main-tts.js not staged — the engine cannot load." >&2
  exit 1
fi

# Emit the meta the extension reads to decide first-install vs update (mirrors
# build-wasm.sh's drift-scanner.meta.json). bytes = total staged size.
BYTES="$(du -sk "$DEST" | cut -f1)"
BYTES="$((BYTES * 1024))"
printf '{\n  "version": "%s",\n  "bytes": %s\n}\n' "$KOKORO_VERSION" "$BYTES" \
  > "$DEST/kokoro.meta.json"
echo "→ staged $(du -sh "$DEST" | cut -f1) → public/kokoro/ (v$KOKORO_VERSION)"
