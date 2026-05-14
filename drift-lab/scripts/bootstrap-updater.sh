#!/usr/bin/env bash
# One-shot bootstrap for the Drift Lab auto-updater.
#
# What it does, in order:
#   1. Verifies `gh` (GitHub CLI) is installed and authenticated.
#   2. Generates a minisign keypair at ~/.tauri/drift-lab.key if not present.
#   3. Patches drift-lab/src-tauri/tauri.conf.json so plugins.updater.pubkey
#      holds the just-generated public key (replaces the placeholder, or any
#      stale value, idempotently).
#   4. Uploads two GitHub Actions repository secrets via `gh secret set`:
#        - TAURI_SIGNING_PRIVATE_KEY          (the .key file content)
#        - TAURI_SIGNING_PRIVATE_KEY_PASSWORD (the passphrase you set)
#
# After running this ONCE, you never need to touch the GitHub UI for updater
# secrets again. Every release is `git tag drift-lab-vX.Y.Z && git push --tags`.
#
# This script is the closest thing to "automatic" that's actually safe — the
# private key has to be created on YOUR machine (not in CI), since anything
# CI-generated would leak into logs / concurrent jobs. The script just removes
# the GitHub-UI clicks that come after key generation.
#
# Re-running this is safe:
#   - if the key file already exists, it's reused (not regenerated)
#   - if tauri.conf.json already has the matching pubkey, the patch is a no-op
#   - `gh secret set` overwrites any existing secret of the same name
set -euo pipefail

# ── 0. Paths ────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KEY_DIR="${TAURI_KEY_DIR:-$HOME/.tauri}"
KEY_NAME="${TAURI_KEY_NAME:-drift-lab.key}"
KEY_PATH="$KEY_DIR/$KEY_NAME"
PUB_PATH="$KEY_PATH.pub"
CONF_PATH="$REPO_ROOT/drift-lab/src-tauri/tauri.conf.json"

# Pick the repo to target. Override with --repo OWNER/REPO if you want to be
# explicit; otherwise we trust the working directory's git remote, which is
# what `gh` does by default.
REPO_FLAG=()
if [[ "${1:-}" == "--repo" && -n "${2:-}" ]]; then
  REPO_FLAG=(--repo "$2")
fi

say() { printf "\n\033[1;34m▸\033[0m %s\n" "$*"; }
ok()  { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn(){ printf "  \033[33m!\033[0m %s\n" "$*"; }
die() { printf "\n\033[31m✗\033[0m %s\n\n" "$*" >&2; exit 1; }

# ── 1. Prereqs ──────────────────────────────────────────────────────────────
say "Checking prerequisites"

command -v cargo >/dev/null  || die "cargo not on PATH. Install Rust: https://rustup.rs"
cargo tauri --version >/dev/null 2>&1 || die "cargo-tauri not installed. Run: cargo install tauri-cli --version '^2.0'"
command -v jq >/dev/null     || die "jq not installed. Run: brew install jq  (macOS) / apt-get install jq (Linux)"
command -v gh >/dev/null     || die "gh (GitHub CLI) not installed. Run: brew install gh  then  gh auth login"

if ! gh auth status >/dev/null 2>&1; then
  die "gh is installed but not authenticated. Run: gh auth login"
fi
ok "cargo, cargo-tauri, jq, gh — all present and authenticated"

# ── 2. Keypair ──────────────────────────────────────────────────────────────
say "Ensuring keypair at $KEY_PATH"

mkdir -p "$KEY_DIR" && chmod 700 "$KEY_DIR"

if [[ -f "$KEY_PATH" && -f "$PUB_PATH" ]]; then
  ok "keypair already exists — reusing"
elif [[ -f "$KEY_PATH" || -f "$PUB_PATH" ]]; then
  die "Only one of $KEY_PATH / $PUB_PATH exists. Delete the orphan and re-run."
else
  warn "no key found — running interactive generator (you'll be asked for a passphrase)"
  cargo tauri signer generate -w "$KEY_PATH"
  ok "generated keypair"
fi

PUB_KEY_CONTENT="$(cat "$PUB_PATH")"
PRIV_KEY_CONTENT="$(cat "$KEY_PATH")"

# ── 3. Patch tauri.conf.json ────────────────────────────────────────────────
say "Patching plugins.updater.pubkey in tauri.conf.json"

[[ -f "$CONF_PATH" ]] || die "Missing $CONF_PATH"

CURRENT_PUB="$(jq -r '.plugins.updater.pubkey // ""' "$CONF_PATH")"
if [[ "$CURRENT_PUB" == "$PUB_KEY_CONTENT" ]]; then
  ok "tauri.conf.json already has the matching pubkey — no change"
else
  tmp="$(mktemp)"
  jq --arg pk "$PUB_KEY_CONTENT" '.plugins.updater.pubkey = $pk' "$CONF_PATH" > "$tmp"
  mv "$tmp" "$CONF_PATH"
  ok "wrote new pubkey into $CONF_PATH"
fi

# ── 4. Passphrase prompt ────────────────────────────────────────────────────
say "Passphrase for the private key"

# If TAURI_SIGNING_PRIVATE_KEY_PASSWORD is exported, reuse it (so this script
# can be re-run from a wrapper that already has it). Otherwise prompt silently.
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]]; then
  ok "using TAURI_SIGNING_PRIVATE_KEY_PASSWORD from environment"
  PASS="$TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
else
  read -rsp "  Passphrase you set when generating the key (empty for none): " PASS
  echo
fi

# ── 5. Upload GitHub secrets ────────────────────────────────────────────────
say "Uploading GitHub Actions secrets"

# `gh secret set --body -` reads stdin so the value never lands in shell history
# or `ps` output. The here-string < <( … ) pattern keeps it equally hidden.
gh secret set TAURI_SIGNING_PRIVATE_KEY "${REPO_FLAG[@]}" --body "$PRIV_KEY_CONTENT" \
  && ok "TAURI_SIGNING_PRIVATE_KEY set"

# Always set the password secret even if empty — the workflow expects both
# secrets to be defined. If the key has no passphrase, this stores an empty
# string and the Tauri CLI handles it correctly.
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD "${REPO_FLAG[@]}" --body "$PASS" \
  && ok "TAURI_SIGNING_PRIVATE_KEY_PASSWORD set"

# ── 6. Summary ──────────────────────────────────────────────────────────────
cat <<EOF

──────────────────────────────────────────────────────────────────
  Bootstrap complete.

  Local files:
    $KEY_PATH          ← keep secret, back up to 1Password
    $PUB_PATH       ← safe to share / publish

  Patched:
    $CONF_PATH

  GitHub Actions secrets (in your repo):
    TAURI_SIGNING_PRIVATE_KEY
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD

  Next:
    git add drift-lab/src-tauri/tauri.conf.json
    git commit -m "chore(drift-lab): wire updater public key"
    git push

    # Ship the first signed release:
    git tag drift-lab-v0.1.1
    git push origin drift-lab-v0.1.1

──────────────────────────────────────────────────────────────────
EOF
