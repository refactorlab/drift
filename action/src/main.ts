import { runProfile, type ProfileReport } from './profile.ts';
import { uploadScan } from './api.ts';
import { createCheckRun } from './check.ts';
import { upsertStickyComment } from './comment.ts';
import { setOutput, setFailed, info, getInput, getEvent } from './core.ts';
import { checkConclusion, shouldFail } from './render.ts';

export async function main(): Promise<void> {
  const apiUrl = getInput('DRIFT_API_URL', 'https://api.drift.dev');
  const apiToken = getInput('DRIFT_API_TOKEN');
  const profileCommand = getInput('DRIFT_PROFILE_COMMAND', 'npx drift-profile');
  const failOn = getInput('DRIFT_FAIL_ON', 'regression') as
    | 'never'
    | 'regression'
    | 'any';
  const wantComment = getInput('DRIFT_COMMENT', 'true') === 'true';
  const githubToken = getInput('GITHUB_TOKEN');

  const event = getEvent();
  const pr = event.pull_request;
  if (!pr) {
    info('No pull_request payload — Drift only runs on pull_request events. Skipping.');
    return;
  }

  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!repoFull) throw new Error('GITHUB_REPOSITORY is not set');
  const [owner, repo] = repoFull.split('/');
  const headSha = pr.head.sha;
  const baselineRef = getInput('DRIFT_BASELINE_REF') || pr.base.ref;

  info(`Profiling PR #${pr.number} (${headSha.slice(0, 7)}) against ${baselineRef}`);
  const report: ProfileReport = await runProfile(profileCommand);

  info(`Uploading scan to ${apiUrl}`);
  const scan = await uploadScan(apiUrl, apiToken, {
    repo: { owner, name: repo },
    pr: {
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      author: pr.user.login,
      url: pr.html_url,
      headSha,
    },
    baselineRef,
    report,
  });

  setOutput('scan-id', String(scan.id));
  setOutput('scan-url', scan.url);
  setOutput('verdict', scan.verdict);
  setOutput('p95-latency-ms', String(scan.p95LatencyMs));

  info(`Verdict: ${scan.verdict} (p95 ${scan.p95LatencyMs}ms vs baseline ${scan.p95BaselineMs}ms)`);

  if (githubToken) {
    await createCheckRun({
      token: githubToken,
      owner,
      repo,
      headSha,
      conclusion: checkConclusion(scan.verdict),
      scan,
    });
    if (wantComment) {
      await upsertStickyComment({
        token: githubToken,
        owner,
        repo,
        prNumber: pr.number,
        scan,
      });
    }
  } else {
    info('No GITHUB_TOKEN provided — skipping check run + PR comment');
  }

  if (shouldFail(scan.verdict, failOn)) {
    setFailed(`Drift verdict: ${scan.verdict}. See ${scan.url}`);
  }
}

