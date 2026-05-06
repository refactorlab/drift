import type { ScanResponse } from './api.ts';
import { info } from './core.ts';
import { annotationsFor, checkSummary, checkTitle } from './render.ts';

type CreateCheckArgs = {
  token: string;
  owner: string;
  repo: string;
  headSha: string;
  conclusion: 'success' | 'failure' | 'neutral';
  scan: ScanResponse;
  fetchImpl?: typeof fetch;
};

export async function createCheckRun(args: CreateCheckArgs): Promise<void> {
  const { token, owner, repo, headSha, conclusion, scan, fetchImpl = fetch } = args;

  const res = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/check-runs`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Drift / performance',
        head_sha: headSha,
        status: 'completed',
        conclusion,
        details_url: scan.url,
        external_id: String(scan.id),
        output: {
          title: checkTitle(scan),
          summary: checkSummary(scan),
          annotations: annotationsFor(scan),
        },
      }),
    },
  );

  if (!res.ok) {
    info(`Failed to create check run (${res.status}): ${await res.text()}`);
    return;
  }
  info(`Created check run for ${headSha.slice(0, 7)} (${conclusion})`);
}
