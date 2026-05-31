// audio-briefing-grounding: structural guards for the "Generate spoken PR
// briefing (AI)" step (8d-pre) and the Models preflight (8a). These lock the
// invariants that make the spoken audio summary (a) reflect WHAT ACTUALLY
// CHANGED in the PR and (b) actually use the AI-inference output whenever the
// model is reachable — rather than silently degrading to the deterministic
// scanner text.
//
// Why structural (regex over the action.yml run: block) rather than behavioral:
// the briefing step shells out to curl + jq + git, which a unit test can't
// faithfully drive without mocking the whole GitHub Models endpoint. These
// assertions pin the wiring so a future refactor of the prompt or the diff
// step can't quietly drop the grounding / English / retry guarantees.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type StepSpec = { name?: string; id?: string; env?: Record<string, string>; run?: string; if?: string };
type ActionDoc = { runs: { steps: StepSpec[] } };

function steps(): StepSpec[] {
  const doc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as ActionDoc;
  return doc.runs.steps;
}
function step(id: string): StepSpec {
  const s = steps().find((x) => x.id === id);
  assert.ok(s, `expected a step with id="${id}"`);
  return s!;
}

test('briefing step is fed the real diff: STATS_PATH + STATUS_PATH from the diff step', () => {
  const brief = step('briefing');
  const env = brief.env ?? {};
  // The numstat (churn) and name-status (A/M/D/R) artifacts the diff step
  // (6b) computes must be wired into the briefing env — this is the data
  // that grounds the summary in what the PR actually touched.
  assert.match(
    String(env.STATS_PATH ?? ''),
    /steps\.diff\.outputs\.stats_path/,
    'briefing must read steps.diff.outputs.stats_path (numstat / LOC churn)',
  );
  assert.match(
    String(env.STATUS_PATH ?? ''),
    /steps\.diff\.outputs\.status_path/,
    'briefing must read steps.diff.outputs.status_path (A/M/D/R file status)',
  );
});

test('briefing prompt includes a "Files changed" field built from the diff artifacts', () => {
  const run = step('briefing').run ?? '';
  // The change-signal block is assembled by awk from the two diff files…
  assert.match(run, /changes="\$\(awk/, 'expected the "changes" block to be assembled via awk over the diff files');
  assert.match(run, /"\$STATUS_PATH"\s+"\$STATS_PATH"/, 'awk must read both STATUS_PATH and STATS_PATH');
  // …and folded into the user message handed to the model.
  assert.match(run, /Files changed \(status/, 'user message must contain a "Files changed" field');
  assert.match(run, /\$\{changes:-\(none provided\)\}/, 'the changes block must be interpolated into the prompt with a safe fallback');
});

test('briefing is generated only on a reachable model (preflight gate intact)', () => {
  const gate = String(step('briefing').if ?? '');
  assert.match(gate, /steps\.ai-ep\.outputs\.preflight_status == '200'/, 'briefing must stay gated on a green preflight');
  assert.match(gate, /steps\.ai-prep\.outcome == 'success'/, 'briefing must stay gated on ai-prep success');
});

test('briefing prompt forces ENGLISH output so the ASCII-only TTS keeps it', () => {
  const run = step('briefing').run ?? '';
  // Non-ASCII briefings sanitize to empty in the audio step and get
  // silently replaced by the PR title. Instructing English at the source
  // keeps the AI content alive through the sanitizer.
  assert.match(run, /Write the briefing in ENGLISH/i, 'prompt must instruct the model to write in English');
});

test('Models preflight backs off on a 429 rate limit instead of failing fast (waits for the AI to respond)', () => {
  // refactorlab/drift#68: a 429 (GitHub Models org-endpoint throttle) on the
  // single-shot probe gated off BOTH AI features and degraded the audio to
  // the commit-led fallback. The probe must retry transient classes (429/5xx/
  // connect-failure), honor Retry-After, and bound its attempts.
  const run = step('ai-ep').run ?? '';
  assert.match(run, /while : ; do/, 'preflight must loop to retry transient failures');
  assert.match(run, /429\|500\|502\|503\|504\|000/, 'preflight must treat 429 + 5xx + connect-failure as retryable');
  assert.match(run, /retry-after/i, 'preflight must honor the server Retry-After header');
  assert.match(run, /PF_MAX=\d+/, 'preflight retry count must be bounded');
});

test('Models preflight decode names the 429 throttle explicitly (actionable log)', () => {
  const run = step('ai-ep').run ?? '';
  assert.match(run, /429\)/, 'decode must have a dedicated 429 branch');
  assert.match(run, /rate-limit|Too Many Requests|throttl/i, 'decode must explain the throttle');
});

test('briefing GENERATION retries with a fixed wait (3 retries / 5s) until the model responds', () => {
  // refactorlab/drift#68: the org Models endpoint commonly answers 429 even
  // after a green preflight, so the summary-generation call itself retries.
  const run = step('briefing').run ?? '';
  assert.match(run, /BRIEF_RETRIES=3/, 'briefing must retry generation 3×');
  assert.match(run, /BRIEF_WAIT=5/, 'briefing must wait 5s between generation retries');
  assert.match(run, /sleep "\$BRIEF_WAIT"/, 'briefing must actually wait between attempts');
  // Retry trigger is an empty reply (a 429 error-JSON yields no content);
  // a curl timeout (28) must NOT be retried (it would multiply the wait).
  assert.match(run, /not retrying a timeout/i, 'briefing must not retry a curl timeout');
  // ai_rc must capture curl's real exit (the `|| ai_rc=$?` form), not the
  // always-zero `... || true` it replaced.
  assert.match(run, /\|\| ai_rc=\$\?/, 'briefing must capture curl exit code correctly');
});
