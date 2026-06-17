#!/usr/bin/env bash
# Build the drift-static-profiler WASM scanner and drop it into public/ so the
# extension can load it. Reuses the existing Rust CLI unchanged (only
# behavior-preserving `#[cfg(feature="native")]` build gates); the wasm build is
# `--no-default-features` for wasm32-wasip1, with the tree-sitter C grammars
# compiled by wasi-sdk's clang.
#
# Zero-prereq: this script is the SINGLE SOURCE OF TRUTH for "how the bundled
# scanner is made" — used by local dev (make wasm) AND CI (npm run build:wasm).
# It self-bootstraps everything it needs:
#   • the Rust wasm32-wasip1 target (via rustup, idempotent)
#   • wasi-sdk (auto-downloaded to $WASI_SDK, default ~/wasi-sdk) — the
#     OS/arch-correct release tarball is picked automatically.
# In CI the wasi-sdk dir + cargo target/ are cached by the workflow, so the
# ~100MB download only happens on a cold cache.
set -euo pipefail

WASI_SDK_VERSION="${WASI_SDK_VERSION:-24}"
WASI_SDK="${WASI_SDK:-$HOME/wasi-sdk}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILER="$(cd "$HERE/../drift-static-profiler" && pwd)"

# Auto-install wasi-sdk if it isn't already staged. Picks the release asset for
# the current OS/arch (verified against the live wasi-sdk-24 release assets).
if [ ! -x "$WASI_SDK/bin/clang" ]; then
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Linux)  os_part="linux"  ;;
    Darwin) os_part="macos"  ;;
    *) echo "error: unsupported OS '$os' — install wasi-sdk manually at \$WASI_SDK ($WASI_SDK)" >&2; exit 1 ;;
  esac
  case "$arch" in
    x86_64|amd64)  arch_part="x86_64" ;;
    arm64|aarch64) arch_part="arm64"  ;;
    *) echo "error: unsupported arch '$arch' — install wasi-sdk manually at \$WASI_SDK ($WASI_SDK)" >&2; exit 1 ;;
  esac
  asset="wasi-sdk-${WASI_SDK_VERSION}.0-${arch_part}-${os_part}.tar.gz"
  url="https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${WASI_SDK_VERSION}/${asset}"

  echo "→ wasi-sdk not found at $WASI_SDK — installing $asset…"
  echo "  ↓ $url"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  # --retry guards against the same transient CI timeouts that hit rustup below.
  curl -fsSL --retry 5 --retry-delay 5 --retry-all-errors "$url" -o "$tmp/wasi-sdk.tar.gz"
  tar -xzf "$tmp/wasi-sdk.tar.gz" -C "$tmp"
  # The tarball's top-level dir name varies by version (e.g.
  # wasi-sdk-24.0-arm64-macos); move whatever it is to $WASI_SDK.
  sdkdir="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n1)"
  rm -rf "$WASI_SDK"
  mv "$sdkdir" "$WASI_SDK"
  if [ ! -x "$WASI_SDK/bin/clang" ]; then
    echo "error: wasi-sdk clang missing after install at $WASI_SDK/bin/clang" >&2
    exit 1
  fi
  echo "→ wasi-sdk installed → $WASI_SDK"
fi

# Ensure the Rust wasm target is installed (idempotent, quick no-op if present).
# `rustup target add` fetches the rust-std component from static.rust-lang.org,
# which intermittently times out in CI ("Connection timed out (os error 110)").
# A single failure shouldn't kill the whole publish, so retry with backoff;
# rustup keeps the partial download and resumes, so retries are cheap.
if command -v rustup >/dev/null 2>&1; then
  if ! rustup target list --installed 2>/dev/null | grep -q wasm32-wasip1; then
    attempts=5
    for i in $(seq 1 "$attempts"); do
      if rustup target add wasm32-wasip1; then
        break
      fi
      if [ "$i" -eq "$attempts" ]; then
        echo "error: failed to add wasm32-wasip1 target after $attempts attempts" >&2
        exit 1
      fi
      echo "→ rustup target add wasm32-wasip1 failed (attempt $i/$attempts) — retrying in $((i * 5))s…" >&2
      sleep "$((i * 5))"
    done
  fi
fi

export WASI_SYSROOT="$WASI_SDK/share/wasi-sysroot"
export CC_wasm32_wasip1="$WASI_SDK/bin/clang"
export AR_wasm32_wasip1="$WASI_SDK/bin/llvm-ar"
export CFLAGS_wasm32_wasip1="--sysroot=$WASI_SYSROOT"

# The same wasm carries the voice control plane (VAD + DuplexCascade FSM) as a
# raw C-ABI export surface (src/voice_wasm.rs) the side-panel voice mode calls
# directly — so there's ONE wasm, not a second wasm-bindgen artifact. These are
# `#[no_mangle]` functions in the binary, NOT reachable from `_start`, so wasm-ld
# would GC them: each must be named with `--export` to land in the wasm export
# section. (Retention through fat-LTO is handled in Rust via
# voice_wasm::keep_voice_exports, referenced from main().) `__wasm_call_ctors`
# is exported too: the voice path instantiates the module WITHOUT running
# `_start`, so JS calls the ctors once itself to initialize the heap.
VOICE_EXPORTS=(
  __wasm_call_ctors
  vp_alloc_f32 vp_free_f32
  vad_new vad_free vad_push_mic
  vad_set_speaking vad_set_thinking vad_set_barge_in_thinking vad_set_output_level
  vad_state_code vad_reset
  vad_get_last_energy vad_get_effective_gate vad_get_noise_floor vad_get_barge_run vad_get_last_reason
  vad_rms vad_resample
)
EXPORT_FLAGS=""
for sym in "${VOICE_EXPORTS[@]}"; do
  EXPORT_FLAGS+=" -C link-arg=--export=$sym"
done

echo "→ building drift-static-profiler.wasm (release, wasm32-wasip1)…"
( cd "$PROFILER" && RUSTFLAGS="${RUSTFLAGS:-}$EXPORT_FLAGS" cargo build --release --bin drift-static-profiler \
    --no-default-features --target wasm32-wasip1 )

SRC="$PROFILER/target/wasm32-wasip1/release/drift-static-profiler.wasm"
DEST="$HERE/public/drift-static-profiler.wasm"
mkdir -p "$HERE/public"
cp "$SRC" "$DEST"
echo "→ copied $(du -h "$DEST" | cut -f1) → public/drift-static-profiler.wasm"

# Emit the version meta the extension reads to decide first-install vs update.
VER="$(grep -m1 '^version' "$PROFILER/Cargo.toml" | sed -E 's/.*"([^"]+)".*/\1/')"
BYTES="$(wc -c < "$DEST" | tr -d ' ')"
printf '{\n  "version": "%s",\n  "bytes": %s,\n  "target": "wasm32-wasip1"\n}\n' "$VER" "$BYTES" \
  > "$HERE/public/drift-scanner.meta.json"
echo "→ wrote public/drift-scanner.meta.json (v$VER)"
