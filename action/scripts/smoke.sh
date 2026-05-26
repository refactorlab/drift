#!/usr/bin/env bash
# Drift action smoke runner.
#
# Spawns the bundled action against a real PR in your sandbox repo, using the
# fixture report in .dev/report.json. Iterate on render or github logic by
# editing src/ → npm run smoke → watch the comment update on the PR.
set -euo pipefail

ACTION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ACTION_DIR"

ENV_FILE="${ACTION_DIR}/.dev/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing ${ENV_FILE}." >&2
  echo "   Copy .dev/.env.example to .dev/.env and fill in your sandbox details." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${GITHUB_TOKEN:?GITHUB_TOKEN missing from .dev/.env}"
: "${DRIFT_SANDBOX_REPO:?DRIFT_SANDBOX_REPO missing from .dev/.env}"
: "${DRIFT_SANDBOX_PR:?DRIFT_SANDBOX_PR missing from .dev/.env}"
: "${DRIFT_SANDBOX_HEAD_SHA:?DRIFT_SANDBOX_HEAD_SHA missing from .dev/.env}"

# Build fresh each run — tiny, ~25ms.
npm run build > /dev/null

# Generate a per-run event.json with the real sandbox PR + head SHA. Keeps the
# checked-in .dev/event.json as a template safe from credentials.
RUN_DIR="$(mktemp -d -t drift-smoke-XXXXXX)"
trap 'rm -rf "$RUN_DIR"' EXIT
EVENT_FILE="${RUN_DIR}/event.json"
REPORT_FILE="${RUN_DIR}/report.json"
OUTPUT_FILE="${RUN_DIR}/github_output"

# Inject the real PR number + head SHA into the event payload.
node -e "
  const fs = require('node:fs');
  const tpl = JSON.parse(fs.readFileSync('${ACTION_DIR}/.dev/event.json', 'utf8'));
  tpl.pull_request.number = ${DRIFT_SANDBOX_PR};
  tpl.pull_request.head.sha = '${DRIFT_SANDBOX_HEAD_SHA}';
  fs.writeFileSync('${EVENT_FILE}', JSON.stringify(tpl));
"

# Rewrite the fixture report's head_sha and PR number to match.
node -e "
  const fs = require('node:fs');
  const r = JSON.parse(fs.readFileSync('${ACTION_DIR}/.dev/report.json', 'utf8'));
  r.pr.number = ${DRIFT_SANDBOX_PR};
  r.pr.head_sha = '${DRIFT_SANDBOX_HEAD_SHA}';
  fs.writeFileSync('${REPORT_FILE}', JSON.stringify(r));
"

touch "$OUTPUT_FILE"

echo "🚀 Running Drift action against ${DRIFT_SANDBOX_REPO}#${DRIFT_SANDBOX_PR}"
echo ""

GITHUB_TOKEN="$GITHUB_TOKEN" \
GITHUB_EVENT_PATH="$EVENT_FILE" \
GITHUB_REPOSITORY="$DRIFT_SANDBOX_REPO" \
GITHUB_OUTPUT="$OUTPUT_FILE" \
DRIFT_REPORT_PATH="$REPORT_FILE" \
DRIFT_FAIL_ON="never" \
DRIFT_COMMENT="true" \
node "${ACTION_DIR}/../dist/index.js"

echo ""
echo "✅ Done. Visit https://github.com/${DRIFT_SANDBOX_REPO}/pull/${DRIFT_SANDBOX_PR} to see the result."
