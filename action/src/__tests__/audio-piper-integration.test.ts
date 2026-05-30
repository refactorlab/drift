// audio-piper-integration: drives the FULL bash of action.yml's
// "Synthesize audio summary" step (8d) end-to-end against a MOCK piper
// stub, asserting the run-time behavior that the structural YAML-grep
// tests in `audio-sanitize.test.ts` only check by string-match.
//
// Why this exists: structural tests confirm the parser regex / threshold
// / rm-and-exit shape is PRESENT in the YAML; they do not exercise it.
// A mock-piper subprocess closes that gap — it lets the bash actually
// PARSE phoneme-count debug lines, ACT on the 400-id training cap,
// SHORT-CIRCUIT on empty WAVs, FAIL-CLOSED on synthesis crashes, etc.
//
// The mock piper is a tiny shell stub controlled by env vars:
//   MOCK_PIPER_PH_MAX      — per-sentence phoneme count to report
//   MOCK_PIPER_FAIL        — exit 1 instead of synthesizing
//   MOCK_PIPER_EMPTY_WAV   — write only the 44-byte WAV header
//   MOCK_PIPER_NO_DEBUG    — suppress the `Synthesizing audio for N` line
//
// All assertions anchor on the diagnostic emoji prefixes the step
// already emits (🎯 🧹 🎧 ⛔ ⚠️ ✅) — they are the most stable surface
// in the step and survive refactors that move bash line ordering.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type StepSpec = { name?: string; id?: string; run?: string };
type ActionDoc = { runs: { steps: StepSpec[] } };

function getAudioStepRun(): string {
  const doc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as ActionDoc;
  const step = doc.runs.steps.find(
    (s) => s.id === 'audio' || s.name === 'Synthesize audio summary',
  );
  assert.ok(step?.run, 'expected "Synthesize audio summary" step with run: block');
  return step!.run!;
}

// ───────────────────── Mock piper stub ─────────────────────
// Pure POSIX sh, no Node deps. Reads stdin, parses --output_file,
// emits one debug line per `. `-split sentence to stderr, then writes
// a minimal-but-valid RIFF/WAVE container so the bash duration math
// has a real `sample_rate` * 2 to divide. The payload is 100 zero
// bytes per phoneme so a typical 100-ph call comfortably clears the
// 1024-byte empty-WAV guard.
const MOCK_PIPER_STUB = `#!/usr/bin/env bash
set -u
output_file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --output_file) output_file="$2"; shift 2 ;;
    --model|--noise-scale|--noise-w|--length-scale|--sentence-silence) shift 2 ;;
    --debug) shift ;;
    *) shift ;;
  esac
done
if [ "\${MOCK_PIPER_FAIL:-0}" = "1" ]; then
  echo "mock piper: forced failure" >&2
  exit 1
fi
text="$(cat)"
ph_max="\${MOCK_PIPER_PH_MAX:-100}"
# Split on '. ' (the post-sanitise sentence separator). awk avoids
# the bash array+IFS portability swamp.
sentence_count=$(printf '%s' "$text" | awk 'BEGIN{RS=". "} NF>0 {n++} END{print n+0}')
[ "$sentence_count" = "0" ] && sentence_count=1
if [ "\${MOCK_PIPER_NO_DEBUG:-0}" != "1" ]; then
  i=0
  while [ "$i" -lt "$sentence_count" ]; do
    echo "[debug] Synthesizing audio for \${ph_max} phoneme id(s)" >&2
    i=$((i + 1))
  done
fi
if [ -z "$output_file" ]; then
  echo "mock piper: missing --output_file" >&2
  exit 2
fi
# RIFF header (44 bytes) — minimal valid PCM 16-bit mono 22050 Hz.
# Pipe printf DIRECTLY to file: bash variables strip null bytes
# (the C string terminator), which would truncate this header — many
# of the 32-bit / 16-bit fields contain 0x00 sub-bytes.
# Uses POSIX octal (\\NNN) instead of bash-only \\xNN hex so the stub
# also works under dash (Ubuntu /bin/sh) if invoked via sh rather
# than the shebang. Byte-for-byte identical to the hex form:
#   0x24=044  0x08=010  0x10=020  0x22=042  0x56=126
#   0x44=104  0xac=254  0x02=002
LC_ALL=C printf 'RIFF\\044\\010\\000\\000WAVEfmt \\020\\000\\000\\000\\001\\000\\001\\000\\042\\126\\000\\000\\104\\254\\000\\000\\002\\000\\020\\000data\\000\\010\\000\\000' \\
  > "$output_file"
if [ "\${MOCK_PIPER_EMPTY_WAV:-0}" = "1" ]; then
  exit 0
fi
# 100 zero bytes per phoneme — overshoots the 1024-byte empty guard for
# any realistic ph_max and gives the duration ratio a non-zero numerator.
payload_bytes=$((ph_max * sentence_count * 100))
[ "$payload_bytes" -lt 200 ] && payload_bytes=200
LC_ALL=C dd if=/dev/zero bs=1 count="$payload_bytes" 2>/dev/null >> "$output_file"
exit 0
`;

// Realistic Piper voice config — mirrors the en_US-ryan-medium shape:
// sample_rate from .audio.sample_rate, phoneme_type, num_speakers,
// espeak.voice. The synth step's jq calls all reference these paths.
const VOICE_CONFIG_JSON = JSON.stringify({
  audio: { sample_rate: 22050, quality: 'medium' },
  espeak: { voice: 'en-us' },
  phoneme_type: 'espeak',
  num_speakers: 1,
  num_symbols: 256,
  phoneme_id_map: { _: [0], '^': [1], $: [2], ' ': [3], '!': [4], "'": [5] },
  inference: { noise_scale: 0.667, length_scale: 1.0, noise_w: 0.8 },
});

// ───────────────────── Harness setup ─────────────────────
// Build a self-contained tempdir per test: stub piper, stub voice files,
// empty briefing/report files, GITHUB_OUTPUT sink. Returns the env vars
// the step's run: block consumes.
type Harness = {
  dir: string;
  env: Record<string, string>;
  outputFile: string;
};

function buildHarness(extra: Record<string, string> = {}): Harness {
  const dir = mkdtempSync(join(tmpdir(), 'drift-piper-int-'));
  const piperDir = join(dir, 'piper');
  const voiceDir = join(dir, 'piper-voices');
  const piperBin = join(piperDir, 'piper');
  mkdirSync(piperDir, { recursive: true });
  mkdirSync(voiceDir, { recursive: true });

  writeFileSync(piperBin, MOCK_PIPER_STUB);
  chmodSync(piperBin, 0o755);

  const voice = 'en_US-ryan-medium';
  // Small but non-empty .onnx — the synth step only checks existence.
  writeFileSync(join(voiceDir, `${voice}.onnx`), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
  writeFileSync(join(voiceDir, `${voice}.onnx.json`), VOICE_CONFIG_JSON);

  // Sinks the step writes to.
  const outputFile = join(dir, 'github-output');
  writeFileSync(outputFile, '');
  const briefingPath = join(dir, 'briefing.txt');
  writeFileSync(briefingPath, 'Hello world. This is a short integration-test briefing. It speaks safely.');
  const reportPath = join(dir, 'drift-report.json');
  writeFileSync(reportPath, JSON.stringify({ pr_review: { business_logic: { summary: 'fallback summary' } } }));

  return {
    dir,
    outputFile,
    env: {
      PATH: process.env.PATH ?? '',
      LC_ALL: 'C',
      PIPER_DIR: piperDir,
      VOICE_DIR: voiceDir,
      PIPER_VOICE: voice,
      WAV_DIR: dir,
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: outputFile,
      BRIEFING_PATH: briefingPath,
      DRIFT_REPORT_PATH: reportPath,
      REPO_NAME: 'drift-test',
      PR_BRANCH: 'integration',
      PR_TITLE: 'Integration test PR',
      ...extra,
    },
  };
}

// Drop the step's run: block to a tempfile and execute it under bash.
// We DO NOT modify the bash — every env input is injected via `env`,
// so the script we run is byte-identical to what GitHub Actions runs.
function runStep(h: Harness): { status: number; stdout: string; stderr: string; outputs: Record<string, string> } {
  const scriptPath = join(h.dir, 'audio-step.sh');
  // Prepend `set -e` parity: GitHub Actions wraps `bash` runs with
  // `set -eo pipefail`. We mirror that so behaviour is faithful.
  const script = ['#!/usr/bin/env bash', 'set -eo pipefail', getAudioStepRun()].join('\n');
  writeFileSync(scriptPath, script);
  chmodSync(scriptPath, 0o755);
  // 15s timeout — generous enough to survive parallel-test resource
  // contention in the full project test suite (npm test fans out via
  // node --test which can launch several integration files at once).
  // In isolation each scenario runs in <1s; the cap only fires on
  // pathological hangs.
  const r = spawnSync('bash', [scriptPath], {
    env: h.env,
    encoding: 'utf8',
    timeout: 15000,
  });
  const outputs = parseGithubOutput(readFileSync(h.outputFile, 'utf8'));
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', outputs };
}

function parseGithubOutput(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// ───────────────────── Tests ─────────────────────

test('happy path: phoneme stats parsed, audio probe runs, synthesized=true', () => {
  const h = buildHarness({ MOCK_PIPER_PH_MAX: '150' });
  const r = runStep(h);
  // The step is continue-on-error wrapped in production; locally it
  // should still exit 0 on a successful synth path.
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  // 🎯 phoneme stats line proves the --debug stderr was parsed.
  assert.match(r.stdout, /🎯 piper phoneme stats: \d+ sentences, max=150 ids/);
  // 🎧 audio probe proves the duration ratio block ran.
  assert.match(r.stdout, /🎧 audio: \d+ bytes, [\d.]+s actual \/ [\d.]+s expected @ 22050Hz/);
  // ✅ final write means the step reached the success tail.
  assert.match(r.stdout, /✅ wrote \d+ bytes/);
  assert.equal(r.outputs.synthesized, 'true');
  assert.ok(r.outputs.wav_path?.endsWith('.wav'), `wav_path missing or wrong: ${r.outputs.wav_path}`);
});

test('ph_max > 400: warning emitted but WAV still ships (warn-only stance)', () => {
  // Round 6 reversed the previous fail-closed-on-ph_max behavior:
  // production runs were silently losing the 🔊 link for borderline
  // briefings even when the audio was perfectly listenable. We still
  // emit the warning + the ph_max_over_cap telemetry tag, but we
  // ship the WAV so reviewers can judge.
  const h = buildHarness({ MOCK_PIPER_PH_MAX: '450' });
  const r = runStep(h);
  assert.equal(r.status, 0, `unexpected status ${r.status}\n${r.stderr}`);
  // Warning mentions the cap + observed max + shipping anyway.
  assert.match(
    r.stdout,
    /⚠️  \d+ sentence\(s\) exceeded the 400-id training cap \(max=450\)/,
    `expected 400-id-cap warning mentioning max=450, got:\n${r.stdout}`,
  );
  assert.match(r.stdout, /shipping the WAV anyway/, 'warn-only stance is clear in stdout');
  // The 🎯 phoneme stats line still ran (it's what TRIGGERED the warn path).
  assert.match(r.stdout, /🎯 piper phoneme stats:.*max=450/);
  // synthesized=true so the upload + render still pick up the audio link.
  assert.equal(r.outputs.synthesized, 'true');
  assert.ok(r.outputs.wav_path?.endsWith('.wav'), 'wav_path emitted (audio link will surface)');
});

test('empty WAV (header-only): WAV deleted, synthesized=false', () => {
  const h = buildHarness({ MOCK_PIPER_EMPTY_WAV: '1' });
  const r = runStep(h);
  assert.equal(r.status, 0);
  // ⚠️ empty-WAV guard prints "only 44 bytes (≤ header+min-PCM)".
  assert.match(
    r.stdout,
    /⚠️\s+piper exited 0 but WAV is only 44 bytes/,
    `expected empty-WAV guard message, got:\n${r.stdout}`,
  );
  assert.equal(r.outputs.synthesized, 'false');
  // The phoneme-stats line must NOT have run — empty-WAV guard fires first.
  assert.doesNotMatch(r.stdout, /🎯 piper phoneme stats:/);
});

test('synthesis crash (exit 1): synthesized=false, failure stderr surfaced', () => {
  const h = buildHarness({ MOCK_PIPER_FAIL: '1' });
  const r = runStep(h);
  assert.equal(r.status, 0, `step itself should exit 0 (fail-soft), got ${r.status}`);
  // ⚠️ piper synthesis failed branch.
  assert.match(r.stdout, /⚠️\s+Piper synthesis failed/);
  assert.equal(r.outputs.synthesized, 'false');
  // No success markers leaked in from the happy-path branch.
  assert.doesNotMatch(r.stdout, /✅ wrote/);
  assert.doesNotMatch(r.stdout, /🎯 piper phoneme stats:/);
});

test('missing --debug output: parse warning fires but synthesized=true', () => {
  // The training-cap gate ONLY fires when ph_counts is parsed; if piper
  // ever stops emitting --debug, we still want the WAV (the duration
  // probe + content probe will still gate gibberish).
  const h = buildHarness({ MOCK_PIPER_NO_DEBUG: '1', MOCK_PIPER_PH_MAX: '100' });
  const r = runStep(h);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stderr}`);
  assert.match(
    r.stdout,
    /⚠️\s+could not parse phoneme counts from piper debug log/,
    `expected parse warning, got:\n${r.stdout}`,
  );
  // No phoneme-stats line because parsing produced nothing.
  assert.doesNotMatch(r.stdout, /🎯 piper phoneme stats:/);
  // Still a successful synthesis — WAV is fine, just no ground-truth count.
  assert.equal(r.outputs.synthesized, 'true');
  assert.match(r.stdout, /✅ wrote \d+ bytes/);
});

test('invalid PIPER_VOICE (illegal chars): warning + early exit, no piper invoked', () => {
  const h = buildHarness({ PIPER_VOICE: '../etc/passwd' });
  const r = runStep(h);
  // The voice-id guard prints `::warning::` and `exit 0`s out before
  // even checking $bin existence.
  assert.equal(r.status, 0);
  assert.match(
    r.stdout,
    /::warning::invalid piper-voice id '\.\.\/etc\/passwd'/,
    `expected illegal-chars warning, got:\n${r.stdout}`,
  );
  assert.equal(r.outputs.synthesized, 'false');
  // None of the downstream diagnostic lines may have run.
  assert.doesNotMatch(r.stdout, /🎚️\s+voice config:/);
  assert.doesNotMatch(r.stdout, /🗣️\s+synthesizing/);
});

test('malformed PIPER_VOICE (wrong shape): warning + early exit', () => {
  // Passes the illegal-char gate but fails the rhasspy-id regex.
  const h = buildHarness({ PIPER_VOICE: 'bogusvoicename' });
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /::warning::malformed piper-voice id 'bogusvoicename'/);
  assert.equal(r.outputs.synthesized, 'false');
});

test('voice config diagnostic line surfaces sample_rate / phoneme_type / num_speakers', () => {
  // The 🎚️ voice config line reads the .onnx.json — proves the config
  // path is wired and the JSON is parseable.
  const h = buildHarness({ MOCK_PIPER_PH_MAX: '50' });
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(
    r.stdout,
    /🎚️\s+voice config: en_US-ryan-medium \(phoneme_type=espeak, speakers=1, sr=22050Hz, espeak=en-us\)/,
    `voice config line missing/wrong, got:\n${r.stdout}`,
  );
});

test('text source priority: BRIEFING_PATH wins over scanner summary', () => {
  // 🧠 message means the briefing branch fired. The scanner summary
  // would emit 📄 instead.
  const h = buildHarness();
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /🧠 using AI handover briefing \(\d+ chars\)/);
  assert.doesNotMatch(r.stdout, /📄 using deterministic scanner summary/);
});

test('text source fallback: empty BRIEFING_PATH falls back to scanner summary', () => {
  const h = buildHarness();
  // Wipe the briefing — fallback path is the deterministic summary.
  writeFileSync(h.env.BRIEFING_PATH, '');
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /📄 using deterministic scanner summary/);
  assert.doesNotMatch(r.stdout, /🧠 using AI handover briefing/);
});

test('WAV basename is {repo}-{branch}.wav and sanitises slashes in branch', () => {
  // Branch with `/` must be flattened to `-` so upload-artifact@v7's
  // basename-as-artifact-name doesn't 422 on path chars.
  const h = buildHarness({ PR_BRANCH: 'feature/foo:bar' });
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  // The wav_path output, if set, must contain the sanitised basename.
  const wavPath = r.outputs.wav_path;
  assert.ok(wavPath, `wav_path missing on success path:\n${r.stdout}`);
  // Forbidden chars `: / \` must not appear in the basename.
  const basename = wavPath!.split('/').pop()!;
  assert.doesNotMatch(basename, /[:\\/]/, `basename has forbidden char: ${basename}`);
  assert.match(basename, /^drift-test-feature-foo_bar\.wav$/);
});

test('phoneme cap caution band (300-400): info line printed, synthesized=true', () => {
  // ph_max in [301, 400] hits the ℹ️ caution-band branch — not a
  // failure, just a quality nudge.
  const h = buildHarness({ MOCK_PIPER_PH_MAX: '350' });
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(
    r.stdout,
    /ℹ️\s+max phoneme count 350 is in the 300–400 caution band/,
    `expected caution-band info line, got:\n${r.stdout}`,
  );
  assert.equal(r.outputs.synthesized, 'true');
});

test('safety: total runtime budget (all paths combined under wall clock)', () => {
  // Cheap smoke that bash + mock piper invocation stays within a tight
  // budget. If this ever blows past ~3s, something is hanging.
  const start = Date.now();
  const h = buildHarness({ MOCK_PIPER_PH_MAX: '80' });
  runStep(h);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 3500, `single run took ${elapsed}ms — investigate before relaxing this`);
});
