#!/usr/bin/env bash
# Stage the OFFICIAL prebuilt scanner WASM from the latest GitHub release into
# public/ — the NON-LOCAL counterpart of build-wasm.sh.
#
#   • make dev   → build-wasm.sh  (your LOCAL ../drift-static-profiler working
#                  tree, so in-progress changes — e.g. the voice FSM — are used).
#   • make build/prod/release → THIS script (the published artifact from CI), so
#                  distributables ship the official, release-pinned scanner.
#
# The repo-wide `releases/latest` points at the desktop app (a different release
# train), so we query the releases API and pick the newest `drift-static-
# profiler-v*` tag (mirrors src/core/scannerDownload.ts + config.ts). Set
# GITHUB_TOKEN to avoid the unauthenticated API rate limit.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${SCANNER_RELEASES_API:-https://api.github.com/repos/refactorlab/drift/releases?per_page=30}"
DL_BASE="${SCANNER_RELEASE_DOWNLOAD:-https://github.com/refactorlab/drift/releases/download}"
PREFIX="${SCANNER_TAG_PREFIX:-drift-static-profiler-v}"
DEST_DIR="$HERE/public"
WASM="$DEST_DIR/drift-static-profiler.wasm"
META="$DEST_DIR/drift-scanner.meta.json"

AUTH=()
[ -n "${GITHUB_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")

echo "→ resolving newest $PREFIX* release…"
TAG="$(curl -fsSL "${AUTH[@]}" "$API" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const rel=JSON.parse(s).find(x=>!x.draft&&!x.prerelease&&(x.tag_name||"").startsWith(process.argv[1]));if(!rel){console.error("no published "+process.argv[1]+"* release found");process.exit(1)}process.stdout.write(rel.tag_name)}catch(e){console.error(e.message);process.exit(1)}})' "$PREFIX")"
echo "→ latest release: $TAG"

mkdir -p "$DEST_DIR"
echo "→ downloading $TAG/drift-static-profiler.wasm…"
curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors "$DL_BASE/$TAG/drift-static-profiler.wasm" -o "$WASM"

# The release usually ships the meta JSON; if it doesn't, synthesize it from the
# downloaded bytes + the tag version (same shape build-wasm.sh writes).
if ! curl -fsSL --retry 3 "$DL_BASE/$TAG/drift-scanner.meta.json" -o "$META" 2>/dev/null; then
  VER="${TAG#"$PREFIX"}"
  BYTES="$(wc -c < "$WASM" | tr -d ' ')"
  printf '{\n  "version": "%s",\n  "bytes": %s,\n  "target": "wasm32-wasip1"\n}\n' "$VER" "$BYTES" > "$META"
fi

echo "→ staged $(du -h "$WASM" | cut -f1) → public/drift-static-profiler.wasm ($TAG)"
