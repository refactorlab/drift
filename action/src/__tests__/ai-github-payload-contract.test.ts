// Contract tests for the createReview payload we POST to GitHub.
//
// GitHub will 422 the WHOLE review if ANY comment violates the schema
// at https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request
// The unit tests assert that buildReviewComments produces the SHAPE
// we expect; this file asserts the BUNDLE-SHIPPED payload from
// ai-suggest.js conforms to the schema, end-to-end.
//
// We hand-roll a strict validator (no ajv at runtime — keeps the
// dist bundle lean) that mirrors GitHub's documented requirements.
// If GitHub adds a field, we add it here and the validator surfaces
// the gap; if we drift, the test fails before a consumer's review 422s.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildReviewComments } from '../ai/post.ts';
import type { AISuggestion } from '../ai/schema.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

// ─── GitHub createReview schema (subset we use) ────────────────────────

type ReviewPayload = {
  owner: string;
  repo: string;
  pull_number: number;
  commit_id: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | 'PENDING';
  body?: string;
  comments?: Array<{
    path: string;
    body: string;
    line?: number;
    side?: 'LEFT' | 'RIGHT';
    start_line?: number;
    start_side?: 'LEFT' | 'RIGHT';
    position?: number;
  }>;
};

/**
 * Validate a single review-comment object against GitHub's documented
 * shape. Returns null on success, an error string on first violation.
 *
 * Sources:
 *   - https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request
 *   - https://docs.github.com/en/rest/pulls/comments#create-a-review-comment-for-a-pull-request
 *   The body of comments[] in createReview shares fields with
 *   createReviewComment (the standalone endpoint).
 */
function validateReviewComment(c: unknown, idx: number): string | null {
  if (!c || typeof c !== 'object') return `comments[${idx}] not an object`;
  const o = c as Record<string, unknown>;

  // REQUIRED
  if (typeof o.path !== 'string' || o.path.length === 0) {
    return `comments[${idx}].path must be a non-empty string`;
  }
  if (typeof o.body !== 'string' || o.body.length === 0) {
    return `comments[${idx}].body must be a non-empty string`;
  }

  // line | position — exactly ONE must drive the anchor. We use `line`
  // (the modern shape); `position` is the legacy diff-position int.
  // Both present is undefined behavior on GitHub's side.
  if (typeof o.line === 'number' && typeof o.position === 'number') {
    return `comments[${idx}]: line and position are mutually exclusive`;
  }
  if (typeof o.line === 'number') {
    if (!Number.isInteger(o.line) || o.line < 1) {
      return `comments[${idx}].line must be an integer ≥ 1 (got ${o.line})`;
    }
  }
  if (typeof o.position === 'number') {
    if (!Number.isInteger(o.position) || o.position < 0) {
      return `comments[${idx}].position must be a non-negative integer`;
    }
  }

  // side — optional, but if present must be LEFT/RIGHT (we ALWAYS use RIGHT).
  if (o.side !== undefined && o.side !== 'LEFT' && o.side !== 'RIGHT') {
    return `comments[${idx}].side must be 'LEFT' | 'RIGHT' (got ${JSON.stringify(o.side)})`;
  }

  // Multi-line range — start_line, start_side. start_line must be ≤ line.
  if (o.start_line !== undefined) {
    if (typeof o.start_line !== 'number' || !Number.isInteger(o.start_line) || o.start_line < 1) {
      return `comments[${idx}].start_line must be an integer ≥ 1`;
    }
    if (typeof o.line !== 'number') {
      return `comments[${idx}].start_line set but line missing — both required for ranges`;
    }
    if (o.start_line > o.line) {
      return `comments[${idx}].start_line (${o.start_line}) > line (${o.line}) — invalid range`;
    }
    // start_side defaults to side when omitted; if present must be RIGHT
    // (we always anchor to the new side).
    if (o.start_side !== undefined && o.start_side !== 'LEFT' && o.start_side !== 'RIGHT') {
      return `comments[${idx}].start_side must be 'LEFT' | 'RIGHT'`;
    }
  }

  return null;
}

function validateReviewPayload(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'payload not an object';
  const o = p as Record<string, unknown>;

  // commit_id — REQUIRED. GitHub 422s if missing or doesn't match a real commit.
  if (typeof o.commit_id !== 'string' || o.commit_id.length === 0) {
    return 'commit_id must be a non-empty string';
  }
  // event — must be one of four documented values.
  const validEvents = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT', 'PENDING'];
  if (typeof o.event !== 'string' || !validEvents.includes(o.event)) {
    return `event must be one of ${validEvents.join('|')} (got ${JSON.stringify(o.event)})`;
  }
  // body — optional but recommended. If present, non-empty string.
  if (o.body !== undefined && (typeof o.body !== 'string' || o.body.length === 0)) {
    return 'body, when present, must be a non-empty string';
  }
  // comments — REQUIRED for our use case (we always include inline anchors).
  if (!Array.isArray(o.comments)) return 'comments must be an array';

  for (let i = 0; i < o.comments.length; i += 1) {
    const err = validateReviewComment(o.comments[i], i);
    if (err) return err;
  }
  return null;
}

// ─── unit-level: buildReviewComments output ───────────────────────────

function sug(overrides: Partial<AISuggestion>): AISuggestion {
  return {
    file: 'a.py',
    line: 1,
    category: 'A',
    confidence: 0.9,
    why_it_matters: 'load-bearing why_it_matters ≥ 10 chars',
    references: [{ url: 'https://example.com/x' }],
    after_code: '    ok',
    ...overrides,
  };
}

test('payload-contract: buildReviewComments output conforms to GitHub schema (single-line)', () => {
  const out = buildReviewComments([sug({ line: 5 })], 'openai/gpt-4o');
  assert.equal(out.length, 1);
  for (let i = 0; i < out.length; i += 1) {
    const err = validateReviewComment(out[i] as unknown, i);
    assert.equal(err, null, `comment ${i} violates GitHub schema: ${err}`);
  }
});

test('payload-contract: multi-line range — start_line, start_side present + start_line ≤ line', () => {
  const out = buildReviewComments(
    [sug({ start_line: 5, line: 8 })],
    'openai/gpt-4o',
  );
  assert.equal(out.length, 1);
  const c = out[0] as Record<string, unknown>;
  assert.equal(c.start_line, 5);
  assert.equal(c.start_side, 'RIGHT');
  assert.equal(c.line, 8);
  assert.equal(c.side, 'RIGHT');
  const err = validateReviewComment(out[0] as unknown, 0);
  assert.equal(err, null, `multi-line comment violates schema: ${err}`);
});

test('payload-contract: no `position` field (we use the modern `line` API exclusively)', () => {
  // GitHub treats `position` + `line` as mutually exclusive — emitting
  // both 422s the whole review. We use `line` only. Pin that.
  const out = buildReviewComments([sug({ line: 5 })], 'openai/gpt-4o');
  for (const c of out) {
    const o = c as Record<string, unknown>;
    assert.equal(o.position, undefined, 'must NEVER emit `position` — it conflicts with `line`');
  }
});

test('payload-contract: every comment side is RIGHT (we never anchor on LEFT side)', () => {
  // The post layer is for proposing CODE (after_code) on a `+` line.
  // GitHub's `side: LEFT` would anchor to a `-` (deleted) line, which
  // is not a place a `suggestion` block can apply. Sanity-pin that
  // every comment is RIGHT, never LEFT.
  const out = buildReviewComments(
    [sug({ line: 5 }), sug({ start_line: 5, line: 7 })],
    'openai/gpt-4o',
  );
  for (const c of out) {
    assert.equal((c as Record<string, unknown>).side, 'RIGHT');
    const ss = (c as Record<string, unknown>).start_side;
    if (ss !== undefined) assert.equal(ss, 'RIGHT');
  }
});

test('payload-contract: comment body carries a ```suggestion fence (GitHub-native commit UI)', () => {
  // Without ```suggestion the body renders as plain markdown — no
  // "Apply suggestion" button on the PR. Every comment we POST must
  // carry the fence; tests in suggestion-fence.test.ts cover the
  // fence selection logic, this one verifies the integration.
  const out = buildReviewComments(
    [sug({ after_code: '    log.info("X")' })],
    'openai/gpt-4o',
  );
  assert.equal(out.length, 1);
  assert.match((out[0] as { body: string }).body, /```suggestion/);
  assert.match((out[0] as { body: string }).body, /log\.info\("X"\)/);
});

// ─── E2E: capture the LIVE payload from dist/ai-suggest.js ────────────

const aiSuggestBundle = resolve(repoRoot, 'dist/ai-suggest.js');

test('payload-contract: live ai-suggest.js POST conforms to GitHub schema (single + multi-line)', async () => {
  // Spawn the bundle. Capture the REAL HTTP body the bundle puts on
  // the wire. Validate it against the schema. The whole point is to
  // catch a regression that escapes the unit tests because it lives
  // in the bundle (a refactor of the payload assembler, a typo in
  // post.ts that survives tsc).
  if (!existsSync(aiSuggestBundle)) return; // smoke skip if dist not built

  const tmp = mkdtempSync(join(tmpdir(), 'drift-payload-contract-'));
  try {
    const envelopePath = join(tmp, 'env.json');
    writeFileSync(envelopePath, JSON.stringify({
      suggestions: [
        sug({ file: 'a.py', line: 3, after_code: '    log.info("X")' }),
        sug({ file: 'b.py', line: 7, start_line: 5, after_code: '    line5\n    line6\n    line7' }),
      ],
    }));
    const eventPath = join(tmp, 'event.json');
    writeFileSync(eventPath, JSON.stringify({
      pull_request: { number: 99, head: { sha: 'real-sha-9' }, base: { sha: 'base-sha' } },
    }));

    let postedBody: unknown = null;
    const server: Server = createServer((req, res) => {
      let chunks = '';
      req.on('data', (c) => { chunks += c; });
      req.on('end', () => {
        if (req.method === 'GET' && /\/pulls\/99\/files/.test(req.url ?? '')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([
            { filename: 'a.py', patch: '@@ -1,2 +1,3 @@\n a\n b\n+log_added' },
            { filename: 'b.py', patch: '@@ -1,4 +1,7 @@\n a\n b\n c\n d\n+e\n+f\n+g' },
          ]));
          return;
        }
        if (req.method === 'POST' && /\/pulls\/99\/reviews/.test(req.url ?? '')) {
          try { postedBody = JSON.parse(chunks); } catch { postedBody = chunks; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 1, state: 'COMMENTED' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
    });
    await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
    const addr = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const result = await new Promise<{ code: number | null; stdout: string }>(
        (resolve_, reject) => {
          const proc = spawn(process.execPath, [aiSuggestBundle], {
            env: {
              ...process.env,
              AI_SUGGESTIONS_PATH: envelopePath,
              DRIFT_MAX_AI_SUGGESTIONS: '3',
              DRIFT_AI_MODEL: 'openai/gpt-4o',
              GITHUB_TOKEN: 'tk',
              GITHUB_API_URL: baseUrl,
              GITHUB_REPOSITORY: 'o/r',
              GITHUB_EVENT_NAME: 'pull_request',
              GITHUB_EVENT_PATH: eventPath,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '';
          proc.stdout.on('data', (c) => { stdout += c; });
          proc.on('exit', (code) => resolve_({ code, stdout }));
          proc.on('error', reject);
        },
      );
      assert.equal(result.code, 0, `bundle failed:\n${result.stdout}`);
      assert.ok(postedBody, 'no review was posted');

      // ── Validate the live payload against GitHub's schema ─────────
      const err = validateReviewPayload(postedBody);
      assert.equal(err, null, `live payload violates GitHub schema: ${err}`);

      // Spot-check critical fields:
      const p = postedBody as ReviewPayload;
      assert.equal(p.commit_id, 'real-sha-9', 'commit_id MUST be the PR head SHA');
      assert.equal(p.event, 'COMMENT');
      assert.equal(p.comments?.length, 2);
      // Multi-line comment has start_line + start_side.
      const multi = p.comments?.find((c) => c.path === 'b.py');
      assert.ok(multi);
      assert.equal(multi!.start_line, 5);
      assert.equal(multi!.start_side, 'RIGHT');
      assert.equal(multi!.line, 7);
      assert.equal(multi!.side, 'RIGHT');
    } finally {
      await new Promise<void>((rs) => server.close(() => rs()));
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── Negative tests: things our validator SHOULD reject ───────────────

test('payload-contract: validator REJECTS missing path / body / commit_id (sanity)', () => {
  // Make sure the validator isn't a no-op. If we ship a regression
  // that strips one of these required fields, the bundle test above
  // depends on the validator catching it.
  assert.notEqual(validateReviewComment({ body: 'x' }, 0), null);
  assert.notEqual(validateReviewComment({ path: 'a.py' }, 0), null);
  assert.notEqual(validateReviewPayload({ event: 'COMMENT', comments: [] }), null); // no commit_id
  assert.notEqual(validateReviewPayload({ commit_id: 's', comments: [] }), null);   // no event
  assert.notEqual(
    validateReviewPayload({ commit_id: 's', event: 'INVALID', comments: [] }),
    null,
  );
});

test('payload-contract: validator REJECTS line < 1 / start_line > line', () => {
  assert.notEqual(
    validateReviewComment({ path: 'a.py', body: 'x', line: 0 }, 0),
    null,
  );
  assert.notEqual(
    validateReviewComment({ path: 'a.py', body: 'x', line: 5, start_line: 10 }, 0),
    null,
  );
});

test('payload-contract: validator REJECTS legacy `position` paired with `line`', () => {
  // GitHub silently picks one and ignores the other; the documented
  // behavior is "don't combine them." Our validator pins that.
  assert.notEqual(
    validateReviewComment({ path: 'a.py', body: 'x', line: 5, position: 3 }, 0),
    null,
  );
});
