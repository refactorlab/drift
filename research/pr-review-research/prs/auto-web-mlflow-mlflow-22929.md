# mlflow/mlflow #22929 — [Admin-UI-3/4] Add Platform Admin pages

**[View PR on GitHub](https://github.com/mlflow/mlflow/pull/22929)**

| | |
|---|---|
| **Author** | @PattaraS |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: This PR's review discussion was dominated by automated reviewers (Copilot, GitHub Actions, mlflow-app bot) with limited substantive human-to-human prose. The most meaningful technical exchanges retrievable from the web page are captured below; some are from the Copilot AI reviewer (kept here because they raise concrete technical concerns), and the author's verbatim responses.

### @PattaraS
> Self-service password changes require current_password — the backend re-asserts the existing password before applying the new one.

### Copilot AI (automated review)
> `handleChangePassword` doesn't send `current_password`, but the `UpdatePasswordRequest` type documents it as required for self-service changes.

### Copilot AI (automated review)
> table headers and primary buttons use `<FormattedMessage>`, but many labels...are hardcoded English.

### @PattaraS (range-diff notes)
> Documented iterative changes including addition of current password validation to `AccountPage.tsx`, clarification of table header descriptions, and implementation of bulk delete functionality with checkbox selection.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
