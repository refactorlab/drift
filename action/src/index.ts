import * as core from '@actions/core';
import { main } from './main.ts';

// Fail-soft: Drift is advisory and must NEVER break a consumer's PR on its
// own error (missing report, bad schema, GitHub API hiccup, …). Any thrown
// error is downgraded to a ::warning:: so the check stays green. The ONLY
// way the action fails is a DELIBERATE `fail-threshold` breach inside main(),
// which calls core.setFailed (sets the exit code without throwing).
main().catch((err) => {
  core.warning(
    `Drift could not complete its review: ${err instanceof Error ? err.message : String(err)}. ` +
      'This does not fail the PR.',
  );
});
