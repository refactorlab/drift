import { Hono } from 'hono';
import { db } from '../db/index.ts';
import { repos, pullRequests } from '../db/schema.ts';
import { verifySignature } from '../github/signature.ts';

const github = new Hono();

github.post('/webhooks', async (c) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: 'webhook_secret_not_configured' }, 503);
  }

  const raw = await c.req.text();
  const ok = await verifySignature(
    secret,
    raw,
    c.req.header('x-hub-signature-256'),
  );
  if (!ok) return c.json({ error: 'invalid_signature' }, 401);

  const event = c.req.header('x-github-event');
  const payload = JSON.parse(raw);

  switch (event) {
    case 'ping':
      return c.json({ pong: true });

    case 'installation':
    case 'installation_repositories':
      // TODO: persist installation metadata once an installations table exists.
      // For now, log and ack so GitHub stops retrying.
      console.log(
        `[drift] installation ${payload.action} for ${payload.installation?.account?.login}`,
      );
      return c.json({ received: true });

    case 'pull_request':
      await handlePullRequest(payload);
      return c.json({ received: true });

    case 'check_run':
      // Re-run requested from the GitHub UI: enqueue a scan job.
      // (Worker not implemented in this slice.)
      if (payload.action === 'rerequested') {
        console.log(
          `[drift] check_run rerequest on ${payload.repository?.full_name} sha=${payload.check_run?.head_sha}`,
        );
      }
      return c.json({ received: true });

    default:
      return c.json({ received: true, ignored: event });
  }
});

async function handlePullRequest(payload: any) {
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const pr = payload.pull_request;

  const [repoRow] = await db
    .insert(repos)
    .values({ owner: repoOwner, name: repoName })
    .onConflictDoUpdate({
      target: [repos.owner, repos.name],
      set: { owner: repoOwner },
    })
    .returning();

  await db
    .insert(pullRequests)
    .values({
      repoId: repoRow.id,
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      commits: pr.commits ?? 1,
      filesChanged: pr.changed_files ?? 0,
      author: pr.user.login,
      status: pr.state === 'closed' ? (pr.merged ? 'merged' : 'closed') : 'open',
      githubUrl: pr.html_url,
    })
    .onConflictDoUpdate({
      target: [pullRequests.repoId, pullRequests.number],
      set: {
        title: pr.title,
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
        status:
          pr.state === 'closed' ? (pr.merged ? 'merged' : 'closed') : 'open',
      },
    });
}

export default github;
