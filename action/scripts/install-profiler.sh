#!/usr/bin/env bash
# Downloads a pinned drift-static-profiler release for the current runner
# OS/arch, verifies its sha256, and adds it to $GITHUB_PATH.
#
# Required env:
#   DRIFT_PROFILER_VERSION   e.g. "v0.6.0"
#   DRIFT_PROFILER_REPO      e.g. "drift-dev/drift"  (defaults to that)
#   RUNNER_OS                provided by GitHub Actions (Linux | macOS | Windows)
#   RUNNER_ARCH              provided by GitHub Actions (X64 | ARM64)
#   GITHUB_PATH              provided by GitHub Actions
#
# Local-binary escape hatch (for `act`-based local testing or for
# pinned-build CI scenarios where the binary is already on the host):
#
#   DRIFT_PROFILER_LOCAL_BIN   path to a prebuilt drift-static-profiler.
#                              When set + executable, this script copies
#                              it onto $GITHUB_PATH and skips the
#                              download path entirely.
#                              Mirrors setup-trivy / setup-go's
#                              "use binary at this path" convention.
set -euo pipefail

# ─── Local-binary fast path ──────────────────────────────────────────────
# Production CI runs leave DRIFT_PROFILER_LOCAL_BIN unset → falls through
# to the GitHub Release download below. Setting it makes the install step
# instant and offline-safe — ideal for `act` self-tests.
if [ -n "${DRIFT_PROFILER_LOCAL_BIN:-}" ] && [ -x "${DRIFT_PROFILER_LOCAL_BIN}" ]; then
  echo "📦 Using local binary at ${DRIFT_PROFILER_LOCAL_BIN}"
  install_dir="${RUNNER_TEMP:-/tmp}/drift-profiler-local"
  mkdir -p "$install_dir"
  cp "$DRIFT_PROFILER_LOCAL_BIN" "$install_dir/drift-static-profiler"
  chmod +x "$install_dir/drift-static-profiler"
  : "${GITHUB_PATH:?GITHUB_PATH not set; this script must run inside a GitHub Action (or act).}"
  echo "$install_dir" >> "$GITHUB_PATH"
  echo "✅ Installed drift-static-profiler (local) at $install_dir"
  "$install_dir/drift-static-profiler" --version 2>/dev/null || true
  exit 0
fi

VERSION="${DRIFT_PROFILER_VERSION:?DRIFT_PROFILER_VERSION not set}"
REPO="${DRIFT_PROFILER_REPO:-drift-dev/drift}"

case "${RUNNER_OS:-}" in
  Linux)   os_part="unknown-linux-gnu" ; archive_ext="tar.gz" ;;
  macOS)   os_part="apple-darwin"      ; archive_ext="tar.gz" ;;
  Windows) os_part="pc-windows-msvc"   ; archive_ext="zip"    ;;
  *) echo "❌ Unsupported RUNNER_OS: ${RUNNER_OS:-<unset>}" >&2 ; exit 1 ;;
esac

case "${RUNNER_ARCH:-}" in
  X64)   arch_part="x86_64"  ;;
  ARM64) arch_part="aarch64" ;;
  *) echo "❌ Unsupported RUNNER_ARCH: ${RUNNER_ARCH:-<unset>}" >&2 ; exit 1 ;;
esac

target="${arch_part}-${os_part}"
asset="drift-static-profiler-${target}.${archive_ext}"
base_url="https://github.com/${REPO}/releases/download/drift-static-profiler-${VERSION}"
archive_url="${base_url}/${asset}"
sha_url="${archive_url}.sha256"

install_dir="${RUNNER_TEMP:-/tmp}/drift-profiler-${VERSION}"
mkdir -p "$install_dir"
cd "$install_dir"

echo "↓ Downloading ${asset}"
curl --fail --silent --show-error --location --output "$asset" "$archive_url"

echo "↓ Downloading ${asset}.sha256"
curl --fail --silent --show-error --location --output "${asset}.sha256" "$sha_url"

# `taiki-e/upload-rust-binary-action` writes "<sha256>  <asset>" into the file,
# which is the format `shasum -c` expects.
if command -v sha256sum > /dev/null 2>&1; then
  sha256sum --check "${asset}.sha256"
else
  shasum -a 256 --check "${asset}.sha256"
fi

echo "📦 Extracting"
case "$archive_ext" in
  tar.gz) tar -xzf "$asset" ;;
  zip)    unzip -q "$asset" ;;
esac

bin_name="drift-static-profiler"
[[ "$RUNNER_OS" == "Windows" ]] && bin_name="${bin_name}.exe"

if [[ ! -x "$bin_name" && ! -f "$bin_name" ]]; then
  # Some releases nest the binary inside a folder named after the target.
  found="$(find . -type f -name "$bin_name" -print -quit)"
  if [[ -z "$found" ]]; then
    echo "❌ Could not locate $bin_name inside $asset" >&2
    exit 1
  fi
  cp "$found" "$bin_name"
fi
chmod +x "$bin_name" 2>/dev/null || true

# Expose on PATH for subsequent steps. $GITHUB_PATH is required to be set.
: "${GITHUB_PATH:?GITHUB_PATH not set; this script must run inside a GitHub Action.}"
echo "$install_dir" >> "$GITHUB_PATH"

echo "✅ Installed $bin_name $VERSION at $install_dir"
"./$bin_name" --version 2>/dev/null || true
