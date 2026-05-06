import type { ScanResponse } from './api.ts';
import { info } from './core.ts';
import { commentBody, STICKY_MARKER } from './render.ts';

type CommentArgs = {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  scan: ScanResponse;
  fetchImpl?: typeof fetch;
};

export async function upsertStickyComment(args: CommentArgs): Promise<void> {
  const { token, owner, repo, prNumber, scan, fetchImpl = fetch } = args;
  const body = commentBody(scan);

  const existing = await findStickyComment(fetchImpl, token, owner, repo, prNumber);
  const url = existing
    ? `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

  const res = await fetchImpl(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    info(`Failed to upsert sticky comment (${res.status}): ${await res.text()}`);
    return;
  }
  info(existing ? 'Updated sticky comment' : 'Created sticky comment');
}

async function findStickyComment(
  fetchImpl: typeof fetch,
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ id: number } | null> {
  const res = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    },
  );
  if (!res.ok) return null;
  const list = (await res.json()) as Array<{ id: number; body: string }>;
  return list.find((c) => c.body?.includes(STICKY_MARKER)) ?? null;
}
