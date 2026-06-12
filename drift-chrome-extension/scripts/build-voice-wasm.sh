#!/usr/bin/env bash
# Build the volley-core turn-taking FSM (Rust → wasm-bindgen, web target) from the
# in-repo source at crates/volley-core, into src/vendor/volley/ where the extension
# imports it (core/voiceAudio.ts). This is the control plane of the live voice agent
# (onset / end-pointing / echo-aware barge-in), decided in-process at audio rate.
#
# Unlike the scanner (a WASI run-to-completion command — see build-wasm.sh), this is
# a STATEFUL wasm-bindgen library: Engine.pushMic(frame) is called ~50x/sec and holds
# turn-taking state across calls. Different target (wasm32-unknown-unknown + wasm-bindgen)
# and different execution model, so it's its own ~18 KB module, not folded into the scanner.
#
# The built artifact IS committed (src/vendor/volley/*), so `npm run build` needs no Rust
# toolchain; run THIS only when crates/volley-core changes. Self-bootstraps the wasm target.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$HERE/src/vendor/volley"

command -v wasm-pack >/dev/null 2>&1 || {
  echo "error: wasm-pack not found — install it: cargo install wasm-pack (or https://rustwasm.github.io/wasm-pack/)" >&2
  exit 1
}

# Idempotent; retry guards the same static.rust-lang.org timeouts build-wasm.sh handles.
if command -v rustup >/dev/null 2>&1; then
  if ! rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown; then
    for i in 1 2 3 4 5; do
      rustup target add wasm32-unknown-unknown && break
      [ "$i" -eq 5 ] && { echo "error: failed to add wasm32-unknown-unknown" >&2; exit 1; }
      echo "→ rustup target add failed (attempt $i/5) — retrying in $((i * 5))s…" >&2; sleep "$((i * 5))"
    done
  fi
fi

echo "→ building volley-core → wasm (release, --target web)…"
wasm-pack build "$HERE/crates/volley-core" --release --target web \
  --out-dir "$OUT" --out-name volley_core

# wasm-pack writes a '*' .gitignore (it assumes pkg is generated) and an npm
# package.json — but we COMMIT this vendored module and don't publish it, so drop both.
rm -f "$OUT/.gitignore" "$OUT/package.json"
echo "→ built $(du -h "$OUT/volley_core_bg.wasm" | cut -f1) → src/vendor/volley/volley_core_bg.wasm"
