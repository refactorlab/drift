// Direct tests for the HTTP layer (src/ai/models-client.ts).
//
// Every other AI test stubs `callModel`. This file actually exercises
// the real `callModel` function against a local stub server so the
// HTTP-specific behavior — URL building, headers, the reasoning-vs-
// classic token-field split, error propagation — is bracketed.
//
// What this catches:
//   - A regression to the URL builder (e.g. missing /chat/completions).
//   - A header rename that breaks Models auth.
//   - The reasoning-model regex drifting (gpt-5 vs gpt-4o).
//   - An error path that silently swallows the body snippet (the
//     specific failure mode `actions/ai-inference@v1` had).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { callModel, isReasoningModel } from '../ai/models-client.ts';

type Handler = (req: IncomingMessage, body: string, res: ServerResponse) => void;
type Stub = {
  server: Server;
  baseUrl: string;
  requests: Array<{ url: string; method: string; headers: Record<string, string | string[] | undefined>; body: unknown }>;
};

async function startStub(handler: Handler): Promise<Stub> {
  const requests: Stub['requests'] = [];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      let parsed: unknown = null;
      try { parsed = chunks ? JSON.parse(chunks) : null; } catch { parsed = chunks; }
      requests.push({
        url: req.url ?? '',
        method: req.method ?? 'GET',
        headers: req.headers,
        body: parsed,
      });
      handler(req, chunks, res);
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests };
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

// ─── isReasoningModel — the model-id discriminator ────────────────────

test('isReasoningModel: gpt-5 family is reasoning', () => {
  assert.equal(isReasoningModel('openai/gpt-5'), true);
  assert.equal(isReasoningModel('openai/gpt-5-mini'), true);
  assert.equal(isReasoningModel('gpt-5'), true);
});

test('isReasoningModel: o-series (o1..o4) is reasoning', () => {
  assert.equal(isReasoningModel('openai/o1'), true);
  assert.equal(isReasoningModel('openai/o3-mini'), true);
  assert.equal(isReasoningModel('o4'), true);
});

test('isReasoningModel: gpt-4o is NOT reasoning (the load-bearing false case)', () => {
  // The most important distinction: gpt-4o ("4o") and o1/o3 ("o<n>")
  // look similar by eye, but only the latter are reasoning models. A
  // regex that matches gpt-4o would send max_completion_tokens to a
  // model that rejects it (400 on parameter error).
  assert.equal(isReasoningModel('openai/gpt-4o'), false);
  assert.equal(isReasoningModel('openai/gpt-4o-mini'), false);
  assert.equal(isReasoningModel('openai/gpt-4.1'), false);
});

test('isReasoningModel: empty string + unknown vendor → false (defaults to classic)', () => {
  assert.equal(isReasoningModel(''), false);
  assert.equal(isReasoningModel('anthropic/claude-opus'), false);
});

// ─── callModel: success path + payload-shape assertions ──────────────

test('callModel: classic model → uses max_tokens, returns content', async () => {
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'classic-reply' } }] }));
  });
  try {
    const out = await callModel({
      endpoint: stub.baseUrl,
      token: 'tk',
      model: 'openai/gpt-4o',
      system: 'sys',
      user: 'usr',
      maxOutputTokens: 1234,
    });
    assert.equal(out, 'classic-reply');
    assert.equal(stub.requests.length, 1);
    const req = stub.requests[0];
    assert.equal(req.url, '/chat/completions', 'endpoint + /chat/completions is the canonical URL');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.authorization, 'Bearer tk');
    assert.equal(req.headers['content-type'], 'application/json');
    assert.equal(req.headers.accept, 'application/vnd.github+json');
    assert.equal(req.headers['x-github-api-version'], '2022-11-28');
    const body = req.body as Record<string, unknown>;
    assert.equal(body.model, 'openai/gpt-4o');
    assert.equal(body.max_tokens, 1234, 'classic models MUST use max_tokens');
    assert.equal(body.max_completion_tokens, undefined, 'classic models MUST NOT carry max_completion_tokens');
  } finally {
    await stopServer(stub.server);
  }
});

test('callModel: reasoning model → uses max_completion_tokens, returns content', async () => {
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'reasoning-reply' } }] }));
  });
  try {
    const out = await callModel({
      endpoint: stub.baseUrl,
      token: 'tk',
      model: 'openai/gpt-5',
      system: 'sys',
      user: 'usr',
      maxOutputTokens: 9999,
    });
    assert.equal(out, 'reasoning-reply');
    const body = stub.requests[0].body as Record<string, unknown>;
    assert.equal(body.max_completion_tokens, 9999, 'reasoning models MUST use max_completion_tokens');
    assert.equal(body.max_tokens, undefined, 'reasoning models MUST NOT carry max_tokens');
  } finally {
    await stopServer(stub.server);
  }
});

test('callModel: trailing slash on endpoint is normalized away', async () => {
  // A consumer-config typo could land us with a trailing slash, e.g.
  // "https://models.github.ai/inference/". Without normalization the
  // URL becomes "/inference//chat/completions" → 404. The client
  // strips the trailing slash before appending.
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
  });
  try {
    const out = await callModel({
      endpoint: `${stub.baseUrl}/`,
      token: 'tk', model: 'openai/gpt-4o',
      system: 's', user: 'u', maxOutputTokens: 100,
    });
    assert.equal(out, 'ok');
    assert.equal(stub.requests[0].url, '/chat/completions');
  } finally {
    await stopServer(stub.server);
  }
});

// ─── callModel: error propagation ────────────────────────────────────

test('callModel: non-2xx status → throws with status + body snippet', async () => {
  // The MOST IMPORTANT error-handling assertion in the whole client:
  // `actions/ai-inference@v1` swallowed bodies, so a 403 surfaced as
  // "403 status code (no body)". The bundle MUST keep the body.
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'forbidden — missing models: read scope' }));
  });
  try {
    await assert.rejects(
      () => callModel({
        endpoint: stub.baseUrl, token: 'tk', model: 'openai/gpt-4o',
        system: 's', user: 'u', maxOutputTokens: 100,
      }),
      (err: Error) => {
        assert.match(err.message, /403/);
        assert.match(err.message, /missing models: read scope/, 'body snippet MUST be in the error');
        return true;
      },
    );
  } finally {
    await stopServer(stub.server);
  }
});

test('callModel: 200 with non-JSON body → throws with snippet', async () => {
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html>this is HTML, not JSON');
  });
  try {
    await assert.rejects(
      () => callModel({
        endpoint: stub.baseUrl, token: 'tk', model: 'openai/gpt-4o',
        system: 's', user: 'u', maxOutputTokens: 100,
      }),
      (err: Error) => {
        assert.match(err.message, /non-JSON response/);
        assert.match(err.message, /doctype html/);
        return true;
      },
    );
  } finally {
    await stopServer(stub.server);
  }
});

test('callModel: 200 JSON but no choices[0].message.content → throws explicitly', async () => {
  // The server replied 200 with valid JSON but the chat shape isn't
  // there (Models server bug, model-side filter, etc.). The client
  // names the problem instead of returning undefined and letting
  // downstream code blow up later with a less-useful trace.
  for (const malformed of [
    {},
    { choices: [] },
    { choices: [{ message: {} }] },
    { choices: [{ message: { content: null } }] },
    { choices: [{ message: { content: 123 } }] },
  ]) {
    const stub = await startStub((_req, _body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(malformed));
    });
    try {
      await assert.rejects(
        () => callModel({
          endpoint: stub.baseUrl, token: 'tk', model: 'openai/gpt-4o',
          system: 's', user: 'u', maxOutputTokens: 100,
        }),
        (err: Error) => {
          assert.match(err.message, /no choices\[0\]\.message\.content/);
          return true;
        },
      );
    } finally {
      await stopServer(stub.server);
    }
  }
});

test('callModel: 500 with empty body → still throws with the status (no swallow)', async () => {
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(500);
    res.end();
  });
  try {
    await assert.rejects(
      () => callModel({
        endpoint: stub.baseUrl, token: 'tk', model: 'openai/gpt-4o',
        system: 's', user: 'u', maxOutputTokens: 100,
      }),
      (err: Error) => {
        assert.match(err.message, /GitHub Models 500/);
        return true;
      },
    );
  } finally {
    await stopServer(stub.server);
  }
});

test('callModel: server returns large body snippet → truncated to 300 chars in the error', async () => {
  // A misbehaving server could spew megabytes of HTML or stack traces.
  // The thrown Error must keep a digestible snippet — not the whole body.
  const huge = 'X'.repeat(10_000);
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(413, { 'Content-Type': 'text/plain' });
    res.end(huge);
  });
  try {
    await assert.rejects(
      () => callModel({
        endpoint: stub.baseUrl, token: 'tk', model: 'openai/gpt-4o',
        system: 's', user: 'u', maxOutputTokens: 100,
      }),
      (err: Error) => {
        // status surfaced
        assert.match(err.message, /413/);
        // snippet kept short — the 300-char cap is documented in the source.
        // Allow some slack for the prefix ("GitHub Models 413: ").
        assert.ok(err.message.length < 600, `error message too long (${err.message.length}) — body snippet not truncated`);
        return true;
      },
    );
  } finally {
    await stopServer(stub.server);
  }
});

// ─── callModel: messages array shape ──────────────────────────────────

test('callModel: messages array carries [system, user] in that order', async () => {
  const stub = await startStub((_req, _body, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
  });
  try {
    await callModel({
      endpoint: stub.baseUrl, token: 'tk', model: 'openai/gpt-4o',
      system: 'THE_SYSTEM', user: 'THE_USER', maxOutputTokens: 100,
    });
    const body = stub.requests[0].body as { messages: Array<{ role: string; content: string }> };
    assert.equal(body.messages.length, 2);
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[0].content, 'THE_SYSTEM');
    assert.equal(body.messages[1].role, 'user');
    assert.equal(body.messages[1].content, 'THE_USER');
  } finally {
    await stopServer(stub.server);
  }
});
