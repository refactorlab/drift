// Mint a Chrome Web Store API refresh token using a DESKTOP OAuth client —
// the loopback flow, no OAuth Playground and no Web client required.
//
//   node scripts/mint-cws-token.mjs
//
// Reads CWS_CLIENT_ID / CWS_CLIENT_SECRET from the environment or ./.env,
// opens the Google consent screen, captures the auth code on localhost, and
// prints (and offers to save) the refresh token. The secret never leaves your
// machine.
//
// Prereqs:
//   • The OAuth client is type "Desktop app" (loopback redirects are allowed
//     on any localhost port without pre-registration).
//   • The OAuth consent screen is "In production" (Testing-mode refresh tokens
//     expire after 7 days).

import { createServer } from 'node:http';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

// ── load CWS_CLIENT_ID / CWS_CLIENT_SECRET from env or .env ─────────────────
function loadEnv() {
  const env = { ...process.env };
  const f = resolve(ROOT, '.env');
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
const env = loadEnv();
const CLIENT_ID = env.CWS_CLIENT_ID;
const CLIENT_SECRET = env.CWS_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('✗ Set CWS_CLIENT_ID and CWS_CLIENT_SECRET (in ./.env or the environment) first.');
  process.exit(1);
}

// ── start a loopback server on a free port, then drive the consent flow ─────
const server = createServer();
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const redirectUri = `http://localhost:${port}`;
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline', // ask for a refresh token
      prompt: 'consent', // force one even on repeat authorizations
    });

  console.log('\n1) A browser will open Google sign-in. Approve the Chrome Web Store scope.');
  console.log('   If it does not open, paste this URL manually:\n');
  console.log('   ' + authUrl + '\n');
  spawn('open', [authUrl], { stdio: 'ignore' }).on('error', () => {});
});

server.on('request', async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (!code && !err) return res.end('Waiting for Google…');

  res.end('✓ Done — you can close this tab and return to the terminal.');
  server.close();

  if (err) {
    console.error(`\n✗ Authorization failed: ${err}`);
    process.exit(1);
  }

  // Exchange the auth code for tokens.
  const port = req.socket.localPort;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: `http://localhost:${port}`,
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await r.json();
  if (!r.ok || !json.refresh_token) {
    console.error('\n✗ Token exchange failed:', JSON.stringify(json, null, 2));
    console.error('  (No refresh_token usually means the consent screen is in "Testing" or the scope was denied.)');
    process.exit(1);
  }

  console.log('\n✓ Refresh token minted:\n');
  console.log('   ' + json.refresh_token + '\n');
  console.log('Next: put it in the CWS_REFRESH_TOKEN GitHub repo secret (and .env for local use).');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question('Append CWS_REFRESH_TOKEN to ./.env now? [y/N] ')).trim().toLowerCase();
  rl.close();
  if (ans === 'y') {
    appendFileSync(resolve(ROOT, '.env'), `\nCWS_REFRESH_TOKEN=${json.refresh_token}\n`);
    console.log('✓ Appended to .env (gitignored).');
  }
  process.exit(0);
});
