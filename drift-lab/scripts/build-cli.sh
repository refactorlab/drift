#!/usr/bin/env bash
# Build the `drift` companion CLI so `tauri build`'s bundler can pick
# it up at `src-tauri/target/release/drift` (declared in
# tauri.conf.json under `bundle.resources`).
#
# Two modes:
#   - default: builds for the host architecture. Right for `make
#     compile` and any single-arch CI matrix entry.
#   - DRIFT_BUILD_UNIVERSAL=1 (macOS only): builds aarch64 + x86_64 and
#     `lipo`s them into a fat binary. Required for the universal
#     `--target universal-apple-darwin` CI build so the .app's
#     bundled `drift` works on BOTH Apple Silicon and Intel Macs.
#
# Invoked from `tauri.conf.json` `beforeBuildCommand`, so the resulting
# `target/release/drift` exists by the time `tauri-build`'s resource
# validator runs.

set -euo pipefail

cd "$(dirname "$0")/../src-tauri"

if [[ "${DRIFT_BUILD_UNIVERSAL:-0}" == "1" ]]; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "scripts/build-cli.sh: DRIFT_BUILD_UNIVERSAL=1 set on non-Darwin host ($(uname -s)) — ignoring and building for host" >&2
    cargo build --release --bin drift
    exit 0
  fi
  echo "▶ building drift CLI as a universal Mach-O (aarch64 + x86_64)"
  # `rustup target add` is idempotent and a no-op when the target is
  # already installed (CI's dtolnay/rust-toolchain action installs both
  # via the `rust_targets` matrix field).
  rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true
  cargo build --release --target aarch64-apple-darwin --bin drift
  cargo build --release --target x86_64-apple-darwin --bin drift
  # Tauri's bundler rewrites `bundle.resources` paths of the form
  # `target/release/...` to `target/<triple>/release/...` when
  # `cargo tauri build --target <triple>` is in play (cargo-convention:
  # cross-target artefacts live under target/<triple>/). The CI mac
  # leg uses --target universal-apple-darwin, so the binary must land
  # at target/universal-apple-darwin/release/drift or the bundler
  # fails the .app build with "Failed to copy binary ... does not
  # exist". Mirror it to target/release/drift so build.rs's
  # placeholder check (which is --target-unaware) and any non-target
  # consumer still finds a valid file at the canonical path.
  mkdir -p target/universal-apple-darwin/release target/release
  lipo -create \
    target/aarch64-apple-darwin/release/drift \
    target/x86_64-apple-darwin/release/drift \
    -output target/universal-apple-darwin/release/drift
  cp -f target/universal-apple-darwin/release/drift target/release/drift
  file target/universal-apple-darwin/release/drift
  echo "✓ universal drift CLI ready at $(pwd)/target/universal-apple-darwin/release/drift (mirrored to target/release/drift)"
else
  echo "▶ building drift CLI for host architecture"
  cargo build --release --bin drift
  echo "✓ drift CLI ready at $(pwd)/target/release/drift"
fi
