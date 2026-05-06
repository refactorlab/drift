# Drift — Performance Scan for Pull Requests

Drift profiles your pull requests, detects p95 / CPU / DB regressions, and posts
a verdict directly on the PR — with code-level annotations and an autofix link.

Two ways to install:

| | GitHub Action | GitHub App |
|---|---|---|
| Where it runs | Your runners | Drift cloud |
| Setup | Add `drift.yml` workflow | One-click install |
| Configuration | `action.yml` inputs | `.drift.yaml` or dashboard |
| Best for | Self-hosted profilers, custom benchmark commands | Zero-touch teams |

---

## Option A — GitHub Action

Drop this into `.github/workflows/drift.yml`:

```yaml
name: Drift
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: drift-dev/drift-action@v1
        with:
          api-token: ${{ secrets.DRIFT_API_TOKEN }}
          profile-command: 'npx drift-profile'
```

### Inputs

| name | required | default | description |
|---|---|---|---|
| `api-url` | no | `https://api.drift.dev` | Drift API base URL |
| `api-token` | yes (hosted) | — | Token from app.drift.dev/settings/tokens |
| `profile-command` | no | `npx drift-profile` | Shell command that writes JSON to `$DRIFT_REPORT_PATH` |
| `baseline-ref` | no | PR base branch | Git ref to compare against |
| `fail-on` | no | `regression` | `never` \| `regression` \| `any` |
| `comment` | no | `true` | Post a sticky PR comment |
| `github-token` | no | `${{ github.token }}` | Used to post check + comment |

### Outputs

- `scan-id` — Drift scan id
- `scan-url` — URL to the report
- `verdict` — `pass` \| `regression` \| `error`
- `p95-latency-ms` — observed p95 latency

### Profile report format

Your `profile-command` writes JSON to `$DRIFT_REPORT_PATH`:

```json
{
  "p95LatencyMs": 184,
  "cpuPct": 41,
  "dbQueries": 23,
  "dbNPlusOne": 1,
  "cacheHitRate": 87,
  "issues": [
    {
      "severity": "high",
      "title": "N+1 in /api/orders",
      "filePath": "src/routes/orders.ts",
      "lineNumber": 42,
      "category": "db",
      "impactMs": 120,
      "problem": "Sequential SELECT for each order line"
    }
  ]
}
```

---

## Option B — GitHub App

Install at https://github.com/marketplace/drift, pick the repos, and Drift starts
running on every PR — no YAML, no Actions minutes.

Configure with an optional `.drift.yaml` at your repo root:

```yaml
fail_on: regression
profile_command: npx drift-profile
ignore:
  - "test/fixtures/**"
notify:
  slack: "#perf-alerts"
```

The App uses these GitHub permissions:
- `contents: read` — diffs, blame
- `pull_requests: write` — sticky comments
- `checks: write` — verdict check + annotations
- `metadata: read`, `members: read`

Webhook events: `pull_request`, `pull_request_review`, `check_run`,
`check_suite`, `installation`, `installation_repositories`, `push`.

---

## How it works

1. PR opens or updates → Drift profiles the candidate build
2. Profile JSON is uploaded to the Drift API
3. Drift compares against the baseline (PR base branch's last green build)
4. Verdict + per-issue annotations posted via the Checks API
5. Sticky comment summarises the diff with a link to the full flame graph
