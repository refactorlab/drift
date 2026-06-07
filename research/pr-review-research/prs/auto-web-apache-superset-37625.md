# apache/superset #37625 — chore(frontend): comprehensive TypeScript quality improvements

**[View PR on GitHub](https://github.com/apache/superset/pull/37625)**

| | |
|---|---|
| **Author** | @rusackas |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @michael-s-molina
> Approving for the files I'm code owner.

### @villebro
> I tend to shoot first and ask questions later. Go for it! ⭐

### @rusackas (PR description / substantive fixes)
> Fixed division by zero when `steps <= 1`

(in Calendar.ts)

### @rusackas (PR description / substantive fixes)
> Fixed XSS vulnerability by escaping country names

(in CountryMap.ts)

### Follow-up / downstream impact
Issue linkage showed this broad refactor had unanticipated side effects requiring follow-up fixes: cross-filter functionality broke (#37853) and MapBox circle sizing issues emerged (#38314).

*Note: bot reviewers (codeant-ai-for-open-source, bito-code-review) flagged sections across eslint-rules, dashboard types, and test files, but their full verbatim text was not rendered on the page.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
