# Privacy Policy — Andy, AI PR review assistant by Drift

**Effective date:** June 2, 2026

Andy ("the extension") is a Chrome side-panel assistant that helps you review
GitHub pull requests. This policy explains what data the extension handles and
what it does **not** do with it.

## Summary

- The extension has **no backend server of its own**. Your settings, the parsed
  PR report, and your chat messages are stored **locally in your browser**
  (`chrome.storage.local`).
- We do **not** sell your data, and we do **not** transfer it to third parties
  except as needed to provide the assistant's core feature (see "AI processing"
  below).
- The extension works as a guest with no account. Google sign-in is optional.

## Data the extension handles

| Category | What | Where it goes |
| --- | --- | --- |
| **Website content** | The rendered Drift/Andy review comment and pull-request details on the GitHub page you are viewing. | Read on your device to display the dashboard; cached locally. |
| **Personal communications** | Messages you type into the assistant's chat. | Stored locally; sent to an AI model provider only to generate a reply (see below). |
| **Authentication information** | *Only if you choose Google sign-in:* an OAuth token and your basic profile (name, email) to show who is signed in. | Stored locally on your device. Never sent to us. |
| **Settings** | Your model, theme, and behavior preferences. | Stored locally on your device. |

The extension uses your browser's **existing GitHub session** to download a
pull request's scan artifacts when you ask it to. It does not collect, store, or
transmit your GitHub credentials.

## AI processing

To answer questions about a pull request, the assistant may send your chat
messages and the relevant PR scan context to an AI model provider that processes
the request **on our behalf** to generate a response. This is limited to
providing the feature you requested. It is not used for advertising, profiling,
sold, or shared for any unrelated purpose.

## What we do NOT collect

We do not collect health, financial, location, web-browsing-history, or
user-activity data, and we do not track you across sites.

## Data retention and control

All local data lives in your browser. You can remove it at any time from the
extension's **Settings → Clear data**, by signing out, or by removing the
extension. Uninstalling the extension deletes its local storage.

## Permissions

The extension requests only the permissions needed for the above: reading the
active GitHub PR tab, side panel UI, local storage, detecting in-page navigation
between PRs, downloading scan artifacts, and (optionally) Google sign-in. Broad
host access is used solely to follow GitHub's artifact-download redirects to
their CDN hosts; no other site data is collected.

## Changes

We may update this policy; the effective date above will change accordingly.

## Contact

Questions about this policy: **[REPLACE WITH YOUR VERIFIED PUBLISHER EMAIL]**
