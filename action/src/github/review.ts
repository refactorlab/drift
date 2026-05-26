import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import type { CodeSuggestion } from '../report.ts';
import { passesQualityBar } from '../report.ts';
import { renderSuggestionBody } from '../render/suggestion.ts';

type Octokit = ReturnType<typeof getOctokit>;

export type PostReviewArgs = {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  suggestions: CodeSuggestion[];
};

/**
 * Post a single PR review carrying every quality-passing suggestion as an
 * inline comment. Review comments — unlike issue comments — render the
 * `suggestion` block with an "Apply suggestion" button.
 *
 * Spec rule: if no suggestion clears the bar, post no review at all.
 */
export async function postReview(args: PostReviewArgs): Promise<void> {
  const { octokit, owner, repo, prNumber, headSha, suggestions } = args;

  const passing = suggestions.filter(passesQualityBar);
  if (passing.length === 0) {
    core.info('No suggestions cleared the quality bar; skipping review.');
    return;
  }

  const comments = passing
    .filter((s) => typeof s.line === 'number')
    .map((s) => ({
      path: s.file,
      line: s.line as number,
      side: 'RIGHT' as const,
      body: renderSuggestionBody(s),
    }));

  if (comments.length === 0) {
    core.info('Suggestions present but none have a line anchor; skipping review.');
    return;
  }

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    commit_id: headSha,
    event: 'COMMENT',
    body: `🟣 **Drift** has ${comments.length} suggestion${comments.length === 1 ? '' : 's'} to apply.`,
    comments,
  });

  core.info(`Posted PR review with ${comments.length} inline suggestion(s).`);
}
