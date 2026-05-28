// Event-agnostic PR-context resolver.
//
// Drift runs under multiple GitHub Actions events:
//   - pull_request — context.payload.pull_request is populated.
//   - issue_comment — the payload has issue.pull_request.url, NOT the full
//     PR object; the action.yml `Resolve PR context` step does the REST
//     fallback and writes DRIFT_PR_* env vars to $GITHUB_ENV.
//
// This module is the single place the TS bundle reads PR identity from:
// it returns whichever source is populated (payload first, env-var
// fallback second), or null when neither has the head SHA we need.

import { context } from '@actions/github';

export type ResolvedPr = {
  number: number;
  headSha: string;
  baseSha?: string;
  baseRef?: string;
  headRef?: string;
  title?: string;
  body?: string;
  htmlUrl?: string;
  author?: string;
};

/**
 * Resolve PR identity from the event payload first, then env-var fallback
 * (DRIFT_PR_*, set by the action.yml derivation step). Returns null when
 * neither source has a head SHA — the caller should skip in that case.
 */
export function resolvePrContext(): ResolvedPr | null {
  const pr = context.payload.pull_request;
  if (pr && typeof pr.head?.sha === 'string' && typeof pr.number === 'number') {
    return {
      number: pr.number,
      headSha: pr.head.sha,
      baseSha: typeof pr.base?.sha === 'string' ? pr.base.sha : undefined,
      baseRef: typeof pr.base?.ref === 'string' ? pr.base.ref : undefined,
      headRef: typeof pr.head?.ref === 'string' ? pr.head.ref : undefined,
      title: typeof pr.title === 'string' ? pr.title : undefined,
      body: typeof pr.body === 'string' ? pr.body : undefined,
      htmlUrl: typeof pr.html_url === 'string' ? pr.html_url : undefined,
      author: typeof pr.user?.login === 'string' ? pr.user.login : undefined,
    };
  }

  const envNumber = Number(process.env.DRIFT_PR_NUMBER ?? '');
  const envHeadSha = (process.env.DRIFT_HEAD_SHA ?? '').trim();
  if (!Number.isInteger(envNumber) || envNumber <= 0 || envHeadSha === '') {
    return null;
  }
  return {
    number: envNumber,
    headSha: envHeadSha,
    baseSha: optEnv('DRIFT_BASE_SHA'),
    baseRef: optEnv('DRIFT_BASE_REF'),
    headRef: optEnv('DRIFT_HEAD_REF'),
    title: optEnv('DRIFT_PR_TITLE'),
    body: optEnv('DRIFT_PR_BODY'),
    htmlUrl: optEnv('DRIFT_PR_HTML_URL'),
    author: optEnv('DRIFT_PR_AUTHOR'),
  };
}

function optEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}
