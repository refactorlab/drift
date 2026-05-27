// Audio-summary footer: dist/index.js appends a "🔊 Listen" link to the
// sticky comment when the action's Piper step uploaded a WAV (the artifact
// URL arrives via DRIFT_AUDIO_URL). Fully fail-soft: no env → no-op.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAudioFooter } from '../main.ts';

const BODY = '## Drift review\n\nsome content';

test('withAudioFooter: appends a Listen link when DRIFT_AUDIO_URL is set', () => {
  const prev = process.env.DRIFT_AUDIO_URL;
  process.env.DRIFT_AUDIO_URL = 'https://github.com/acme/shop/actions/runs/1/artifacts/42';
  try {
    const out = withAudioFooter(BODY);
    assert.ok(out.startsWith(BODY), 'original body is preserved at the top');
    assert.match(out, /🔊 \*\*\[Listen to this PR summary\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/1\/artifacts\/42\)\*\*/);
  } finally {
    if (prev === undefined) delete process.env.DRIFT_AUDIO_URL;
    else process.env.DRIFT_AUDIO_URL = prev;
  }
});

test('withAudioFooter: no-op when DRIFT_AUDIO_URL is unset or blank', () => {
  const prev = process.env.DRIFT_AUDIO_URL;
  try {
    delete process.env.DRIFT_AUDIO_URL;
    assert.equal(withAudioFooter(BODY), BODY, 'unset → unchanged');

    process.env.DRIFT_AUDIO_URL = '   ';
    assert.equal(withAudioFooter(BODY), BODY, 'blank → unchanged');
  } finally {
    if (prev === undefined) delete process.env.DRIFT_AUDIO_URL;
    else process.env.DRIFT_AUDIO_URL = prev;
  }
});
