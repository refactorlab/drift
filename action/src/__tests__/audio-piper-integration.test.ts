// audio integration: drives the FULL bash of action.yml's "Synthesize
// audio summary" step (8d) end-to-end against a MOCK sherpa-onnx-offline-tts
// stub, asserting the run-time behavior that the structural YAML-grep tests
// in `audio-sanitize.test.ts` only check by string-match.
//
// (Filename kept as audio-piper-integration for snapshot/fixture stability;
// the engine is now Kokoro via sherpa-onnx, not Piper.)
//
// Why this exists: structural tests confirm the voice→sid map / asset checks
// / rm-and-exit shape is PRESENT in the YAML; they do not exercise it. A mock
// sherpa subprocess closes that gap — it lets the bash actually SELECT the
// text source, MAP the voice to a sid, SHORT-CIRCUIT on empty WAVs, and
// FAIL-SOFT on synthesis crashes.
//
// The mock binary is a tiny shell stub controlled by env vars:
//   MOCK_TTS_FAIL        — exit 1 instead of synthesizing
//   MOCK_TTS_EMPTY_WAV   — write only the 44-byte WAV header
//
// All assertions anchor on the diagnostic emoji prefixes the step already
// emits (🎙️ 🧹 🎧 ⛔ ⚠️ ✅) — the most stable surface in the step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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

// ───────────────────── Mock sherpa-onnx-offline-tts stub ─────────────────────
// Pure bash, no Node deps. Parses --output-filename=PATH (sherpa uses the
// `=` form), treats the trailing non-flag arg as the spoken text, then
// writes a minimal-but-valid RIFF/WAVE container. Payload is scaled to the
// text length (~2180 bytes/char) so the bash duration-ratio (chars/22 sec
// vs bytes/(24000*2) sec) lands near 1.0 — keeping the happy path inside
// the [0.6, 1.5] band. The header declares 24 kHz / 16-bit / mono.
const MOCK_TTS_STUB = `#!/usr/bin/env bash
set -u
output_file=""
text=""
for arg in "$@"; do
  case "$arg" in
    --output-filename=*) output_file="\${arg#*=}" ;;
    --*) : ;;                      # kokoro-model / voices / tokens / data-dir / num-threads / sid
    *) text="$arg" ;;             # trailing positional = the text to speak
  esac
done
if [ "\${MOCK_TTS_FAIL:-0}" = "1" ]; then
  echo "mock sherpa-onnx: forced failure" >&2
  exit 1
fi
if [ -z "$output_file" ]; then
  echo "mock sherpa-onnx: missing --output-filename" >&2
  exit 2
fi
# sherpa-onnx prints these diagnostics to stderr; the step greps them.
echo "Elapsed seconds: 0.5 s" >&2
echo "Audio duration: 1.0 s" >&2
echo "Real-time factor (RTF): 0.5/1.0 = 0.5" >&2
# RIFF header (44 bytes) — minimal valid PCM 16-bit mono 24000 Hz.
# Pipe printf DIRECTLY to file: bash variables strip null bytes (the C
# string terminator), which would truncate this header. POSIX octal so
# the stub also works under dash. 24000=0x5DC0 → \\300\\135 ; byte rate
# 48000=0xBB80 → \\200\\273 ; block align 2 ; bits 16.
LC_ALL=C printf 'RIFF\\044\\010\\000\\000WAVEfmt \\020\\000\\000\\000\\001\\000\\001\\000\\300\\135\\000\\000\\200\\273\\000\\000\\002\\000\\020\\000data\\000\\010\\000\\000' \\
  > "$output_file"
if [ "\${MOCK_TTS_EMPTY_WAV:-0}" = "1" ]; then
  exit 0
fi
# Scale payload to char count so the duration ratio lands near 1.0.
chars=\${#text}
payload_bytes=$((chars * 2180))
[ "$payload_bytes" -lt 2048 ] && payload_bytes=2048
LC_ALL=C dd if=/dev/zero bs=1 count="$payload_bytes" 2>/dev/null >> "$output_file"
exit 0
`;

// ───────────────────── Harness setup ─────────────────────
// Build a self-contained tempdir per test: stub binary under sherpa/bin,
// stub Kokoro model assets under kokoro/, empty briefing/report files,
// GITHUB_OUTPUT sink. Returns the env vars the step's run: block consumes.
type Harness = {
  dir: string;
  env: Record<string, string>;
  outputFile: string;
};

function buildHarness(extra: Record<string, string> = {}): Harness {
  const dir = mkdtempSync(join(tmpdir(), 'drift-tts-int-'));
  const sherpaDir = join(dir, 'sherpa');
  const sherpaBinDir = join(sherpaDir, 'bin');
  const sherpaLibDir = join(sherpaDir, 'lib');
  const kokoroDir = join(dir, 'kokoro');
  const espeakDir = join(kokoroDir, 'espeak-ng-data');
  const bin = join(sherpaBinDir, 'sherpa-onnx-offline-tts');
  mkdirSync(sherpaBinDir, { recursive: true });
  mkdirSync(sherpaLibDir, { recursive: true });
  mkdirSync(espeakDir, { recursive: true });

  writeFileSync(bin, MOCK_TTS_STUB);
  chmodSync(bin, 0o755);

  // Kokoro model assets — the synth step only checks existence (the mock
  // binary ignores their contents). int8 model name so the bash prefers it.
  writeFileSync(join(kokoroDir, 'model.int8.onnx'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
  writeFileSync(join(kokoroDir, 'voices.bin'), Buffer.from([0, 1, 2, 3]));
  writeFileSync(join(kokoroDir, 'tokens.txt'), '_ 0\n^ 1\n$ 2\n');
  // Multi-lang Kokoro ships per-locale lexicons; the synth step passes the
  // US-English + Chinese ones via --kokoro-lexicon when present.
  writeFileSync(join(kokoroDir, 'lexicon-us-en.txt'), 'hello h ɛ l oʊ\n');
  writeFileSync(join(kokoroDir, 'lexicon-zh.txt'), '你好 n i h a o\n');
  writeFileSync(join(espeakDir, 'phontab'), 'stub');

  // Sinks the step writes to.
  const outputFile = join(dir, 'github-output');
  writeFileSync(outputFile, '');
  const briefingPath = join(dir, 'briefing.txt');
  writeFileSync(briefingPath, 'Hello world. This is a short integration-test briefing. It speaks safely.');
  // The commit-based fallback file (step 8d-fb) — NOT created by default, so
  // `[ -s ... ]` is false and the AI briefing wins. Tests exercising the
  // fallback write to this path explicitly.
  const fallbackPath = join(dir, 'briefing-fallback.txt');
  const reportPath = join(dir, 'drift-report.json');
  writeFileSync(reportPath, JSON.stringify({ pr_review: { business_logic: { summary: 'fallback summary' } } }));

  return {
    dir,
    outputFile,
    env: {
      PATH: process.env.PATH ?? '',
      LC_ALL: 'C',
      SHERPA_DIR: sherpaDir,
      KOKORO_DIR: kokoroDir,
      TTS_VOICE: 'af_heart',
      WAV_DIR: dir,
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: outputFile,
      BRIEFING_PATH: briefingPath,
      FALLBACK_BRIEFING_PATH: fallbackPath,
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

test('happy path: voice mapped to sid, audio probe runs, synthesized=true', () => {
  const h = buildHarness();
  const r = runStep(h);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  // 🎙️ voice→sid line proves the name→sid mapping ran (af_heart → 3).
  assert.match(r.stdout, /🎙️  voice af_heart → sid 3/);
  // 🎧 audio probe proves the duration ratio block ran at 24 kHz.
  assert.match(r.stdout, /🎧 audio: \d+ bytes, [\d.]+s actual \/ [\d.]+s expected @ 24000Hz/);
  // ✅ final write means the step reached the success tail.
  assert.match(r.stdout, /✅ wrote \d+ bytes/);
  assert.equal(r.outputs.synthesized, 'true');
  assert.ok(r.outputs.wav_path?.endsWith('.wav'), `wav_path missing or wrong: ${r.outputs.wav_path}`);
});

test('voice name → sid mapping: am_michael resolves to sid 16', () => {
  const h = buildHarness({ TTS_VOICE: 'am_michael' });
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  assert.match(r.stdout, /🎙️  voice am_michael → sid 16/);
  assert.equal(r.outputs.synthesized, 'true');
});

test('unknown voice name: warns + falls back to af_heart (sid 3), still synthesizes', () => {
  const h = buildHarness({ TTS_VOICE: 'zz_nope' });
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  assert.match(r.stdout, /::warning::unknown tts-voice 'zz_nope'.*falling back to af_heart \(sid 3\)/);
  assert.match(r.stdout, /🎙️  voice af_heart → sid 3/);
  assert.equal(r.outputs.synthesized, 'true');
  assert.match(r.outputs.defenses_fired ?? '', /\btts_voice_unknown\b/);
});

test('invalid voice (illegal chars): warns + falls back to af_heart', () => {
  const h = buildHarness({ TTS_VOICE: '../etc/passwd' });
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /::warning::invalid tts-voice '\.\.\/etc\/passwd' \(illegal chars\)/);
  assert.match(r.stdout, /🎙️  voice af_heart → sid 3/);
  assert.equal(r.outputs.synthesized, 'true');
  assert.match(r.outputs.defenses_fired ?? '', /\btts_voice_unknown\b/);
});

test('assets missing: sherpa binary or model absent → synthesized=false', () => {
  // Point KOKORO_DIR at an empty dir so model.int8.onnx/voices/tokens are gone.
  const h = buildHarness();
  h.env.KOKORO_DIR = join(h.dir, 'nonexistent-kokoro');
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /⚠️  sherpa-onnx binary \/ Kokoro model assets missing/);
  assert.equal(r.outputs.synthesized, 'false');
  assert.match(r.outputs.defenses_fired ?? '', /\btts_assets_missing\b/);
  assert.doesNotMatch(r.stdout, /🗣️\s+synthesizing/);
});

test('empty WAV (header-only): WAV deleted, synthesized=false', () => {
  const h = buildHarness({ MOCK_TTS_EMPTY_WAV: '1' });
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(
    r.stdout,
    /⚠️\s+synth exited 0 but WAV is only 44 bytes/,
    `expected empty-WAV guard message, got:\n${r.stdout}`,
  );
  assert.equal(r.outputs.synthesized, 'false');
  assert.match(r.outputs.defenses_fired ?? '', /\bwav_too_small\b/);
});

test('synthesis crash (exit 1): synthesized=false, failure stderr surfaced', () => {
  const h = buildHarness({ MOCK_TTS_FAIL: '1' });
  const r = runStep(h);
  assert.equal(r.status, 0, `step itself should exit 0 (fail-soft), got ${r.status}`);
  assert.match(r.stdout, /⚠️\s+sherpa-onnx synthesis failed/);
  assert.equal(r.outputs.synthesized, 'false');
  assert.doesNotMatch(r.stdout, /✅ wrote/);
});

test('kokoro model diagnostic line surfaces model name + voice + sample rate', () => {
  const h = buildHarness();
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(
    r.stdout,
    /🎚️  kokoro model: model\.int8\.onnx, voice af_heart \(sid 3\), sr=24000Hz/,
    `kokoro model line missing/wrong, got:\n${r.stdout}`,
  );
});

test('fp32 fallback: only model.onnx present (no int8) is still used', () => {
  const h = buildHarness();
  // Remove the int8 model, drop in an fp32-named one.
  unlinkSync(join(h.env.KOKORO_DIR, 'model.int8.onnx'));
  writeFileSync(join(h.env.KOKORO_DIR, 'model.onnx'), Buffer.from([0, 1, 2, 3]));
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  assert.match(r.stdout, /🎚️  kokoro model: model\.onnx,/);
  assert.equal(r.outputs.synthesized, 'true');
});

test('text source priority: BRIEFING_PATH wins over scanner summary', () => {
  const h = buildHarness();
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /🧠 using AI handover briefing \(\d+ chars\)/);
  assert.doesNotMatch(r.stdout, /📄 using deterministic scanner summary/);
});

test('skip: BOTH the AI briefing AND the commit fallback empty → no audio (no title-only substitute)', () => {
  const h = buildHarness();
  writeFileSync(h.env.BRIEFING_PATH, ''); // AI summarization did not run
  // FALLBACK_BRIEFING_PATH is not created by buildHarness → also absent.
  const r = runStep(h);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /⏭️  No AI briefing and no commit-based fallback present — skipping audio summary/);
  assert.equal(r.outputs.synthesized, 'false');
  assert.doesNotMatch(r.stdout, /🧠 using AI handover briefing/);
  assert.doesNotMatch(r.stdout, /📝 using commit-based fallback briefing/);
  assert.doesNotMatch(r.stdout, /🗣️\s+synthesizing/);
});

test('commit fallback: empty AI briefing + present FALLBACK_BRIEFING_PATH → synthesizes from commits', () => {
  const h = buildHarness();
  writeFileSync(h.env.BRIEFING_PATH, ''); // AI summarization did not run
  writeFileSync(
    h.env.FALLBACK_BRIEFING_PATH,
    'This is a commit based summary of this pull request. It contains 3 commits. We refactored the Marmot handler. Please review the changes carefully.',
  );
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  assert.match(r.stdout, /📝 using commit-based fallback briefing \(\d+ chars\) — AI briefing was unavailable this run\./);
  assert.doesNotMatch(r.stdout, /🧠 using AI handover briefing/);
  // The fallback's words actually reached the synthesizer (sanitizer
  // lowercases capital runs, so match loosely).
  assert.match(r.stdout, /marmot/i, `fallback content did not reach the synthesizer:\n${r.stdout}`);
  assert.equal(r.outputs.synthesized, 'true');
  assert.ok(r.outputs.wav_path?.endsWith('.wav'), 'wav_path emitted (audio link will surface)');
  assert.match(r.outputs.defenses_fired ?? '', /\bcommit_fallback\b/, 'commit_fallback telemetry tag recorded');
});

test('priority: AI briefing WINS even when a commit fallback is also present', () => {
  const h = buildHarness();
  writeFileSync(h.env.BRIEFING_PATH, 'We optimized the Narwhal cache layer. It is safe.');
  writeFileSync(h.env.FALLBACK_BRIEFING_PATH, 'This is a commit based summary mentioning a Pangolin.');
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  assert.match(r.stdout, /🧠 using AI handover briefing/);
  assert.doesNotMatch(r.stdout, /📝 using commit-based fallback briefing/);
  assert.match(r.stdout, /narwhal/i, 'AI briefing content was spoken');
  assert.doesNotMatch(r.stdout, /pangolin/i, 'commit fallback must NOT leak when the AI briefing is present');
  assert.doesNotMatch(r.outputs.defenses_fired ?? '', /commit_fallback/, 'commit_fallback must NOT fire when AI briefing wins');
});

test('AI briefing CONTENT reaches the synthesizer — not just the branch', () => {
  const h = buildHarness({ PR_TITLE: 'Quokka feature work' });
  writeFileSync(
    h.env.BRIEFING_PATH,
    'We refactored the Zebrafish handler module. It now batches writes. The change is safe.',
  );
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  assert.match(r.stdout, /🧠 using AI handover briefing/);
  // Briefing words reached the synthesizer (case-insensitive: the sanitizer
  // lowercases runs of 2+ capitals, so match loosely).
  assert.match(r.stdout, /zebrafish/i, `briefing content did not reach the synthesizer:\n${r.stdout}`);
  assert.doesNotMatch(r.stdout, /quokka/i, `PR-title fallback leaked into synthesizer input:\n${r.stdout}`);
});

test('WAV basename is {repo}-{branch}.wav and sanitises slashes in branch', () => {
  const h = buildHarness({ PR_BRANCH: 'feature/foo:bar' });
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);
  const wavPath = r.outputs.wav_path;
  assert.ok(wavPath, `wav_path missing on success path:\n${r.stdout}`);
  const basename = wavPath!.split('/').pop()!;
  assert.doesNotMatch(basename, /[:\\/]/, `basename has forbidden char: ${basename}`);
  assert.match(basename, /^drift-test-feature-foo_bar\.wav$/);
});

test('safety: total runtime budget (all paths combined under wall clock)', () => {
  const start = Date.now();
  const h = buildHarness();
  runStep(h);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 3500, `single run took ${elapsed}ms — investigate before relaxing this`);
});
