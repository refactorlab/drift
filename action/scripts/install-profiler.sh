#!/usr/bin/env bash
# Installs drift-static-profiler onto $GITHUB_PATH. Zero-friction for the
# consumer — defaults auto-detect the latest GitHub Release containing the
# binary and use the ambient $GITHUB_TOKEN (rate-limit friendly).
#
# Required env (provided automatically by GitHub Actions):
#   RUNNER_OS, RUNNER_ARCH, GITHUB_PATH
#
# Optional env (action.yml exposes these as inputs):
#   DRIFT_PROFILER_REPO         GitHub repo hosting the binary releases.
#                               Default: refactorlab/drift
#
#   DRIFT_PROFILER_RELEASE_TAG  Pin to a specific release tag (e.g.
#                               drift-static-profiler-v0.8.1). Default: empty →
#                               auto-detect the latest drift-static-profiler-v*
#                               release that has our binary asset attached.
#
#   DRIFT_PROFILER_INSTALL_DIR  Where to put the binary. action.yml's
#                               actions/cache step passes the same path
#                               so cache restore + this script point at
#                               the SAME dir. If the binary's already
#                               there (cache hit), we exit early.
#
#   DRIFT_PROFILER_LOCAL_BIN    Path to a prebuilt binary. When set +
#                               executable, copy it and skip the
#                               GitHub Release flow entirely. Used by
#                               `make hello-test` for offline act runs.
#
#   GITHUB_TOKEN                Used to authenticate the API call when
#                               auto-detecting the latest release. Raises
#                               the rate limit from 60/hr (anonymous) to
#                               5000/hr (per-consumer). Anonymous is fine
#                               for public release downloads themselves.
set -euo pipefail

# ─── Local-binary fast path ──────────────────────────────────────────────
# Production CI leaves DRIFT_PROFILER_LOCAL_BIN unset → falls through to
# the GitHub Release flow. Setting it makes the install instant +
# offline-safe — ideal for `act` self-tests.
if [ -n "${DRIFT_PROFILER_LOCAL_BIN:-}" ] && [ -x "${DRIFT_PROFILER_LOCAL_BIN}" ]; then
  echo "📦 Using local binary at ${DRIFT_PROFILER_LOCAL_BIN}"
  install_dir="${DRIFT_PROFILER_INSTALL_DIR:-${RUNNER_TEMP:-/tmp}/drift-profiler-local}"
  mkdir -p "$install_dir"
  cp "$DRIFT_PROFILER_LOCAL_BIN" "$install_dir/drift-static-profiler"
  chmod +x "$install_dir/drift-static-profiler"
  : "${GITHUB_PATH:?GITHUB_PATH not set; this script must run inside a GitHub Action (or act).}"
  echo "$install_dir" >> "$GITHUB_PATH"
  echo "✅ Installed drift-static-profiler (local) at $install_dir"
  "$install_dir/drift-static-profiler" --version 2>/dev/null || true
  exit 0
fi

REPO="${DRIFT_PROFILER_REPO:-refactorlab/drift}"

# ─── Resolve OS/arch ─────────────────────────────────────────────────────
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

# ─── Resolve the release tag ─────────────────────────────────────────────
# Zero-config default: query GitHub for the latest release whose tag
# matches our naming convention AND has the binary attached.
auth_args=()
if [ -n "${GITHUB_TOKEN:-}" ]; then
  auth_args=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
fi

if [ -n "${DRIFT_PROFILER_RELEASE_TAG:-}" ]; then
  TAG="$DRIFT_PROFILER_RELEASE_TAG"
  echo "📌 Using pinned release tag: $TAG"
else
  echo "🔍 Auto-detecting latest drift-static-profiler release in $REPO"
  if ! command -v jq > /dev/null 2>&1; then
    echo "⚠️  jq not on PATH — can't auto-detect. Set DRIFT_PROFILER_RELEASE_TAG explicitly."
    exit 0
  fi
  # Fetch the first 100 releases (sorted by created date). We accept the
  # most recent `drift-static-profiler-v*` release that publishes the
  # binary asset for this OS/arch. per_page is 100 (not 30) because the
  # repo also cuts frequent `drift-lab-v*` desktop releases — with a small
  # page the profiler release could fall off the window between bumps.
  # Filtering by asset name guarantees the release actually has what we
  # need (vs. picking the most recent and 404'ing later).
  releases_json="$(curl --fail --silent --location "${auth_args[@]}" \
      "https://api.github.com/repos/${REPO}/releases?per_page=100" 2>/dev/null || echo '[]')"
  TAG="$(echo "$releases_json" | jq -r --arg asset "$asset" '
    [.[]
      | select(.draft == false)
      | select(.prerelease == false)
      | select(.tag_name | test("^drift-static-profiler-v"))
      | select(any(.assets[]?; .name == $asset))
    ][0].tag_name // empty
  ')"
  if [ -z "$TAG" ]; then
    echo "⚠️  No release in $REPO has $asset yet."
    echo "    Skipping install — the scan step will detect the missing binary and skip too."
    exit 0
  fi
  echo "📌 Latest release with the binary: $TAG"
fi

archive_url="https://github.com/${REPO}/releases/download/${TAG}/${asset}"

# Checksum asset naming differs by producer:
#   • drift-static-profiler-release.yml (taiki-e/upload-rust-binary-action,
#     the single source of truth) REPLACES the archive extension:
#         drift-static-profiler-<target>.sha256
#   • Older drift-lab desktop releases APPENDED it:  <archive>.tar.gz.sha256
# Try the canonical name first, then the legacy one, so a pinned older tag
# still verifies. (Requesting only the legacy name 404s on every current
# release and silently drops integrity verification.)
checksum_asset="drift-static-profiler-${target}.sha256"
sha_url="https://github.com/${REPO}/releases/download/${TAG}/${checksum_asset}"
sha_url_legacy="${archive_url}.sha256"

# ─── Install dir resolution + cache short-circuit ────────────────────────
# action.yml exports DRIFT_PROFILER_INSTALL_DIR so its actions/cache step
# and this script point at the SAME dir. When that dir was restored from
# cache, the binary's already in place — exit early.
install_dir="${DRIFT_PROFILER_INSTALL_DIR:-${RUNNER_TEMP:-/tmp}/drift-static-profiler/${TAG}/${arch_part}}"
bin_name="drift-static-profiler"
[[ "${RUNNER_OS:-}" == "Windows" ]] && bin_name="${bin_name}.exe"

if [ -x "$install_dir/$bin_name" ]; then
  echo "♻️  Cache hit: drift-static-profiler $TAG already at $install_dir"
  : "${GITHUB_PATH:?GITHUB_PATH not set; this script must run inside a GitHub Action (or act).}"
  echo "$install_dir" >> "$GITHUB_PATH"
  "$install_dir/$bin_name" --version 2>/dev/null || true
  exit 0
fi

mkdir -p "$install_dir"
cd "$install_dir"

# ─── Download archive ────────────────────────────────────────────────────
# Graceful skip on 404 so the action stays green if a release went away
# or has no binary for this OS/arch. Downstream scan step also wraps.
echo "↓ Downloading ${asset}"
if ! curl --fail --silent --show-error --location "${auth_args[@]}" \
     --output "$asset" "$archive_url"; then
  echo "⚠️  Could not download $archive_url"
  echo "    Release tag $TAG exists but the asset for $target may be missing."
  echo "    Skipping install — the scan step will detect + skip too."
  exit 0
fi

echo "↓ Downloading checksum (${checksum_asset})"
if curl --fail --silent --show-error --location "${auth_args[@]}" \
     --output "${asset}.sha256" "$sha_url"; then
  : # canonical name found
elif curl --fail --silent --show-error --location "${auth_args[@]}" \
     --output "${asset}.sha256" "$sha_url_legacy"; then
  echo "   (used legacy ${asset}.sha256 name)"
else
  # Remove any empty/partial file curl may have left so the verify block
  # below doesn't read a blank hash and false-positive a mismatch.
  rm -f "${asset}.sha256"
  echo "⚠️  No checksum asset for ${asset} — proceeding without sha verification."
fi

# Verify by extracting the expected hash and comparing manually rather
# than using `sha256sum --check`. Some upstream release jobs embed a
# directory prefix (e.g. "staging/<asset>") into the checksum file —
# `--check` would then try to open that path and fail. Reading just the
# first field sidesteps whatever filename is recorded.
if [ -f "${asset}.sha256" ]; then
  expected="$(awk 'NR==1{print $1}' "${asset}.sha256")"
  if command -v sha256sum > /dev/null 2>&1; then
    actual="$(sha256sum "$asset" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$asset" | awk '{print $1}')"
  fi
  if [ "$expected" != "$actual" ]; then
    echo "❌ Checksum mismatch for $asset" >&2
    echo "   expected: $expected" >&2
    echo "   actual:   $actual" >&2
    exit 1
  fi
fi

echo "📦 Extracting"
case "$archive_ext" in
  tar.gz) tar -xzf "$asset" ;;
  zip)    unzip -q "$asset" ;;
esac

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

echo "✅ Installed $bin_name from $TAG at $install_dir"
"./$bin_name" --version 2>/dev/null || true
