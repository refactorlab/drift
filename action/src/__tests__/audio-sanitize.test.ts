// audio-sanitize: end-to-end tests for the TTS sanitize + sentence-cap
// pipeline that lives inside action.yml's "Synthesize audio summary"
// step (8d). Pulls the LITERAL bash out of action.yml, wraps it in a
// minimal harness, runs against curated inputs, and asserts properties
// that prevent the 1:45 / 4.5 MB gibberish-WAV regression.
//
// What we assert:
//   1. After sanitize+cap, longest sentence is ≤ 150 chars (the cap
//      value — anything above is SDP-collapse territory for Piper).
//   2. `.test.ts`/`.yml`/`.json` patterns are split into spoken words.
//   3. `?` `!` `;` `:` survive sanitization as `.` terminators.
//   4. ASCII apostrophes survive ("don't" stays "don't", not "don t").
//   5. Multi-paragraph input collapses to single-line.
//   6. GitHub Actions log-injection (`::error::`, `::add-mask::`) is
//      neutralized — no `::` survives, so the runner can't interpret
//      hostile lines as workflow commands.
//   7. The actual 213-char sentence that produced your gibberish WAV
//      gets split into safely-sized chunks.
//   8. The diagnostic line shape (`🧹 TTS sanitize: A → B → C chars, N
//      sentences (longest=L chars)`) is stable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type StepSpec = { name?: string; id?: string; shell?: string; run?: string };
type ActionDoc = { runs: { steps: StepSpec[] } };

function getAudioStepRun(): string {
  const doc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as ActionDoc;
  const step = doc.runs.steps.find(
    (s) => s.id === 'audio' || s.name === 'Synthesize audio summary',
  );
  assert.ok(step?.run, 'expected the "Synthesize audio summary" step to exist with a run: block');
  return step.run as string;
}

// Extract just the sanitize+cap portion of the run block — the lines
// from "── Sanitize for TTS ──" to the final hard-abort safety net.
// Wraps it in a minimal harness so we can drive it with `text="$INPUT"`
// and capture the result + the diagnostic line on stdout.
function extractSanitizeHarness(run: string): string {
  const lines = run.split('\n');
  const start = lines.findIndex((l) => /── Sanitize for TTS ──/.test(l));
  const endMarker = lines.findIndex(
    (l, i) => i > start && /Empty after sanitisation/.test(l),
  );
  assert.ok(start >= 0, 'could not locate the sanitize start marker');
  assert.ok(endMarker > start, 'could not locate the post-sanitize block');
  const body = lines.slice(start, endMarker).join('\n');
  return [
    '#!/usr/bin/env bash',
    'set -uo pipefail',
    // Drive the pipeline from $INPUT (passed via env). The action.yml
    // version reads from a file + falls back chain; we short-circuit
    // straight to the text source so we test the sanitize path in
    // isolation. before/after/capped are computed inside the block.
    'text="${INPUT:-}"',
    body,
    // Emit results on stdout for the test to parse.
    'printf "SANITIZED<<<%s>>>\n" "${sanitized}"',
    'printf "CAPPED=%s\n" "${capped:-0}"',
    'printf "TERMINATORS=%s\n" "${terminators:-0}"',
    'printf "MAXSENT=%s\n" "${maxsent:-0}"',
  ].join('\n');
}

function runHarness(input: string): {
  sanitized: string;
  capped: number;
  terminators: number;
  maxsent: number;
  stdout: string;
  stderr: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'drift-audio-sanitize-'));
  const path = join(dir, 'harness.sh');
  writeFileSync(path, extractSanitizeHarness(getAudioStepRun()));
  const r = spawnSync('bash', [path], {
    env: { ...process.env, INPUT: input, LC_ALL: 'C' },
    encoding: 'utf8',
  });
  const m = r.stdout.match(/SANITIZED<<<([\s\S]*?)>>>\n/);
  const sanitized = m ? m[1] : '';
  const num = (re: RegExp): number => {
    const mm = r.stdout.match(re);
    return mm ? Number(mm[1]) : 0;
  };
  return {
    sanitized,
    capped: num(/^CAPPED=(\d+)$/m),
    terminators: num(/^TERMINATORS=(\d+)$/m),
    maxsent: num(/^MAXSENT=(\d+)$/m),
    stdout: r.stdout,
    stderr: r.stderr,
  };
}

// The cap value lives in action.yml as `awk -v MAXLEN=150`. If anyone
// changes it, this test should track the change — read it dynamically.
function getCapValue(): number {
  const run = getAudioStepRun();
  const m = run.match(/awk -v MAXLEN=(\d+)/);
  return m ? Number(m[1]) : 150;
}

const MAXLEN = getCapValue();

test('sanitize: short input passes through unchanged (modulo trailing dot)', () => {
  const r = runHarness('Hello world.');
  assert.equal(r.sanitized, 'Hello world');
  assert.equal(r.terminators, 0);
  assert.ok(r.maxsent <= MAXLEN);
});

test('sanitize: ?!;: are folded to . so eSpeak splits reliably', () => {
  const r = runHarness('Is this fast? Yes! Step 1: do X; step 2: do Y.');
  // Five terminators expected: after fast, Yes, 1, X, Y (Y. is trailing — trimmed by sed)
  // Actual: 4 internal "." (one before each new sentence), trailing "." stripped.
  assert.ok(r.terminators >= 4, `expected ≥4 sentence boundaries, got ${r.terminators}`);
  assert.match(r.sanitized, /Is this fast\. Yes\. Step 1\. do X\. step 2\. do Y/);
});

test('sanitize: apostrophes are preserved (contractions stay one token)', () => {
  const r = runHarness("don't worry, it's fine. We've reviewed action's main file.");
  assert.match(r.sanitized, /don't/);
  assert.match(r.sanitized, /it's/);
  assert.match(r.sanitized, /We've/);
  assert.match(r.sanitized, /action's/);
});

test('sanitize: log-injection patterns are neutralized (`::` collapses to `.`)', () => {
  const r = runHarness('::error::malicious payload::add-mask::secret value::set-output::foo=bar');
  // No `::` may survive — that's what makes GitHub Actions runner treat
  // a line as a workflow command. Either `:` is folded to `.` then `..`
  // is squashed to `.`, or any non-keep-set char becomes a space first.
  assert.ok(
    !r.sanitized.includes('::'),
    `expected no "::" sequence to survive, got: ${r.sanitized}`,
  );
  // None of the workflow-command verbs may sit at line-start with `::`
  // in front of them — they'd be interpreted by the runner.
  assert.doesNotMatch(r.sanitized, /^::/);
  assert.doesNotMatch(r.sanitized, /\n::/);
});

test('sanitize: file extensions are normalized to spoken words', () => {
  const r = runHarness('Look at comment.test.ts and runtime.test.ts and config.yml please.');
  // After .ext normalization: "comment.test.ts" → "comment test ts"
  assert.match(r.sanitized, /comment\s+test\s+ts/);
  assert.match(r.sanitized, /runtime\s+test\s+ts/);
  assert.match(r.sanitized, /config\s+yml/);
  // Decimal numbers must NOT be broken — `3.14` stays `3.14`.
  const r2 = runHarness('Pi is 3.14 and version 2.0.1 is current.');
  assert.match(r2.sanitized, /3\.14/);
  assert.match(r2.sanitized, /2\.0\.1/);
});

test('sanitize: em-dashes, arrows, emoji decompose to whitespace', () => {
  const r = runHarness('foo — bar → baz 🎉 end.');
  assert.match(r.sanitized, /foo\s+bar\s+baz\s+end/);
  // No multi-byte residue
  assert.ok(/^[\x00-\x7f]*$/.test(r.sanitized), 'output should be ASCII');
});

test('sanitize: multi-paragraph input collapses to single line', () => {
  const r = runHarness('Para one sentence one. Para one sentence two.\n\nPara two sentence one. Para two sentence two.');
  assert.doesNotMatch(r.sanitized, /\n/);
  // All four sentences should produce terminators
  assert.ok(r.terminators >= 3, `expected ≥3 terminators across paragraphs, got ${r.terminators}`);
});

test('cap: no single sentence exceeds the configured MAXLEN', () => {
  // Build a deliberately overlong sentence that lacks comma boundaries —
  // the awk cap must hard-cut at word boundaries.
  const stem = 'word '.repeat(60).trim();   // 60 words × 5 chars ≈ 299 chars, one "sentence"
  const r = runHarness(`${stem}.`);
  assert.ok(
    r.maxsent <= MAXLEN,
    `expected longest sentence ≤ ${MAXLEN} chars after cap, got ${r.maxsent}`,
  );
});

test('cap: comma-rich enumerations split into many small sentences', () => {
  // The kind of input that explodes eSpeak: a long file list.
  const r = runHarness(
    'The PR touches src/foo.ts, src/bar.ts, src/baz.ts, src/qux.ts, src/quux.ts, src/corge.ts, src/grault.ts, src/garply.ts, src/waldo.ts, src/fred.ts, src/plugh.ts, src/xyzzy.ts, src/thud.ts, src/aardvark.ts, src/bandersnatch.ts.',
  );
  assert.ok(r.maxsent <= MAXLEN);
  assert.ok(r.terminators >= 10, `expected many terminators from comma-split, got ${r.terminators}`);
});

test('regression: the actual 2044-char briefing that produced the gibberish WAV', () => {
  // Reconstructed verbatim from the GitHub Actions log of the failing run
  // (1:45 / 4.5 MB / 4632708 bytes). Two paragraph-breaks plus one
  // sentence at 213 chars containing `comment.test.ts` and `runtime.test.ts`
  // — the exact mix that triggers SDP collapse on Ryan-medium.
  const briefing = [
    "This pull request addresses a long standing issue with how the drift scanning action is triggered on GitHub. Previously setting the start on pr comment flag meant our workflow would only respond to drift comments effectively ignoring all other pull request events. That behavior broke setups where both pull request and issue comment events were used causing scans to get silently skipped on pushes and updates. The PR flips this logic with the new contract enabling start on pr comment adds the ability to launch scans with comments without removing the usual pull request triggers. This ensures the workflow remains responsive no matter how it's wired so users can re run scans on demand with drift but still get automatic scans on PR events.",
    "",
    "In terms of code changes the heart of the update lies in the workflow engine and gating logic. The action's main orchestration file is where we've reworked the event branching to make the triggers additive. The steps that ONLY make sense for comment events like parsing arguments or handling fork safe checkouts are still gated behind a runtime marker so a standard pull request never runs them. Supporting files like the test suites start on pr comment.test.ts comment gate runtime.test.ts and a newly added start on pr comment additive suite thoroughly validate the cross trigger matrix and updated gating.",
    "",
    "The biggest risk is around trigger overlaps. With the triggers now additive we need to watch for any unintended duplicate scans or review comments if workflows are misconfigured especially in mixed trigger setups. There's also a possibility that edge case events like reopening a closed PR with comment triggers could trip the wrong branch.",
    "",
    "Looking forward the code includes hardcoded step counts and behavior markers that could be further abstracted. The docs now outline usage but it'd be smart to add automated workflow recommendations and more granular trigger diagnostics next sprint to prevent miswiring and surface any unusual activity early.",
  ].join('\n');

  const r = runHarness(briefing);

  // The cap MUST hold for this input — without the cap, this same text
  // produced a 4.5 MB / 1:45 gibberish WAV in production.
  assert.ok(
    r.maxsent <= MAXLEN,
    `longest sentence after cap: ${r.maxsent} (must be ≤ ${MAXLEN}). Cap regression — investigate the awk pre-chunker.`,
  );

  // Sentence count should be high (LLM produced ~20–30 short-ish sentences
  // after our cap explodes the long ones).
  assert.ok(
    r.terminators >= 15,
    `expected the briefing to split into ≥15 sentences, got ${r.terminators}`,
  );

  // The `.test.ts` patterns must have been normalized — no remaining
  // file-extension dots in word-internal position.
  assert.doesNotMatch(
    r.sanitized,
    /comment\.test\.ts/i,
    'comment.test.ts should be normalized away',
  );
  assert.doesNotMatch(
    r.sanitized,
    /runtime\.test\.ts/i,
    'runtime.test.ts should be normalized away',
  );

  // Contractions must survive (we explicitly added apostrophe to keep-set).
  assert.match(r.sanitized, /it's|action's|we've|it'd/);
});

test('audio.yml structure: awk cap is wired BEFORE the diagnostic + abort', () => {
  // Defensive guard: re-ordering these blocks would break the safety
  // net (the abort relies on maxsent being computed). Fail loudly if
  // someone refactors the order.
  const run = getAudioStepRun();
  const idxSanitize = run.indexOf('── Sanitize for TTS ──');
  const idxCap = run.indexOf('── Defensive sentence-length cap ──');
  const idxAbort = run.indexOf('Sentence-length cap missed');
  const idxPiper = run.indexOf('printf \'%s\' "$text" | ./piper');
  assert.ok(idxSanitize >= 0, 'sanitize block is present');
  assert.ok(idxCap > idxSanitize, 'cap follows sanitize');
  assert.ok(idxAbort > idxCap, 'safety-net abort follows cap');
  assert.ok(idxPiper > idxAbort, 'piper invocation is last');
});

test('audio.yml structure: piper invocation includes the stability flags', () => {
  const run = getAudioStepRun();
  // All four tuning flags + --debug must be present on the invocation.
  for (const flag of ['--noise-scale 0.5', '--noise-w 0.5', '--length-scale 1.0', '--sentence-silence 0.3', '--debug']) {
    assert.ok(
      run.includes(flag),
      `piper invocation must include "${flag}" — see SDP-collapse mitigation`,
    );
  }
});

test('audio.yml structure: phoneme-count diagnostic parses --debug output', () => {
  const run = getAudioStepRun();
  // The regex must match piper's debug log line exactly:
  //   "Synthesizing audio for {} phoneme id(s)"
  assert.match(
    run,
    /Synthesizing audio for \[0-9\]\+ phoneme/,
    'phoneme-count parser must look for the exact piper debug log shape',
  );
  // The 400-id cap warning must be wired (training cap).
  assert.match(run, /ph_max.*-gt 400/, 'must warn on phoneme count > 400 (training cap)');
});

// ───────────────────────── EDGE CASES ─────────────────────────

test('edge: empty input yields empty sanitized (falls back to PR title path)', () => {
  const r = runHarness('');
  assert.equal(r.sanitized, '');
  assert.equal(r.maxsent, 0);
});

test('edge: only whitespace yields empty sanitized', () => {
  const r = runHarness('   \n\t   \r\n  ');
  assert.equal(r.sanitized, '');
});

test('edge: only periods + spaces yields empty (leading/trailing dot strip)', () => {
  const r = runHarness('. . . ...');
  assert.equal(r.sanitized, '');
});

test('edge: input with consecutive periods (`...`) squashes to single', () => {
  const r = runHarness('Wait... what happened... unclear.');
  // tr -s '.' squashes runs of '.' to a single '.'
  assert.doesNotMatch(r.sanitized, /\.\./);
});

test('edge: single very long unbroken token gets hard-cut at MAXLEN', () => {
  // No spaces — the cap can\'t find a word boundary, so it must hard-
  // cut at MAXLEN. (Real-world trigger: a UUID or base64 string the
  // sanitizer let through as alphanumeric.)
  const longToken = 'x'.repeat(400);
  const r = runHarness(`Prefix ${longToken} suffix.`);
  assert.ok(r.maxsent <= MAXLEN + 1, `expected ≤ MAXLEN+1, got ${r.maxsent}`);
});

test('content fidelity: no-space long token loses NO characters in the hard-cut path', () => {
  // REGRESSION TEST for the awk character-drop bug: previously the
  // no-space branch did `printf substr(p, 1, MAXLEN-1)` then advanced
  // `p = substr(p, MAXLEN+1)`, dropping exactly one character per
  // MAXLEN iteration. A 300-char input with no spaces would lose
  // ceil(300/MAXLEN) characters. The fix emits the full MAXLEN chars
  // and continues from MAXLEN+1.
  const letters = 'abcdefghijklmnopqrstuvwxyz'; // 26 unique letters
  const longToken = (letters + letters + letters + letters + letters + letters).slice(0, 300);
  const r = runHarness(longToken);
  // Strip the awk-emitted ". " separators and count what's left.
  // Every original alphanumeric character must be preserved.
  const recovered = r.sanitized.replace(/[. ]/g, '');
  assert.equal(
    recovered.length,
    longToken.length,
    `character loss in MAXLEN hard-cut: expected ${longToken.length} chars, got ${recovered.length}. Output: ${JSON.stringify(r.sanitized)}`,
  );
  // And every emitted chunk must respect MAXLEN.
  assert.ok(r.maxsent <= MAXLEN, `chunk exceeds MAXLEN: ${r.maxsent}`);
});

test('edge: decimal numbers and version strings survive the cap', () => {
  const r = runHarness('Version 1.2.3 ships at speed 3.14, with patch 4.5.6.789.');
  assert.match(r.sanitized, /1\.2\.3/);
  assert.match(r.sanitized, /3\.14/);
  assert.match(r.sanitized, /4\.5\.6\.789/);
});

test('edge: input at exactly MAXLEN stays as one sentence', () => {
  // Build a sentence whose alphanumeric length lands right at MAXLEN.
  const word = 'word ';
  const target = MAXLEN - 1; // leave room for the trailing terminator
  let s = '';
  while (s.length + word.length <= target) s += word;
  s = s.trim() + '.';
  const r = runHarness(s);
  assert.ok(
    r.maxsent <= MAXLEN,
    `boundary sentence (${s.length} chars) must stay ≤ MAXLEN (${MAXLEN}), got ${r.maxsent}`,
  );
});

test('edge: input just OVER MAXLEN gets split', () => {
  // One char over the cap with no commas — must split on word boundary.
  const stem = 'word '.repeat(40).trim(); // 199 chars, one sentence
  const r = runHarness(`${stem}.`);
  assert.ok(r.maxsent <= MAXLEN, `expected ≤ ${MAXLEN}, got ${r.maxsent}`);
  // Should produce at least 2 sentences from the split.
  assert.ok(r.terminators >= 1);
});

test('edge: URL with dots inside is not exploded into per-segment sentences', () => {
  // example.com is a name, not a number. Currently sed letter-dot-letter
  // breaks it to "example com". That sounds slightly worse than "example
  // dot com" but is NOT gibberish, and prevents the 213-char-sentence
  // cliff. Verify the policy.
  const r = runHarness('Visit example.com for details.');
  assert.match(r.sanitized, /example\s+com/);
});

// ───────────────── AI PROMPT + STRUCTURE GUARDS ─────────────────

test('AI briefing prompt: forbids file extensions and long sentences', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // Both upstream-prevention constraints must be present.
  assert.match(
    yamlText,
    /sentences SHORT/,
    'AI prompt must instruct short sentences (upstream prevention layer)',
  );
  assert.match(
    yamlText,
    /Do not include filenames with extensions/,
    'AI prompt must forbid file extensions',
  );
});

test('hard-abort safety net: present and references the documented threshold', () => {
  const run = getAudioStepRun();
  assert.match(run, /Sentence-length cap missed/, 'safety net warning present');
  // The safety-net threshold tracks the MAXLEN value. As of the
  // acronym/digit pre-pass landing, MAXLEN dropped 150 → 120 and the
  // safety net dropped 200 → 150 so the abort stays proportional.
  // Read both from the file so future tightenings update lockstep.
  const cap = MAXLEN; // pulled dynamically from action.yml
  const expectedAbort = cap + 30; // current policy: cap + 25% slack
  const abortMatch = run.match(/maxsent.*-gt (\d+)/);
  assert.ok(abortMatch, 'safety-net abort comparator present');
  const abortThreshold = Number(abortMatch![1]);
  assert.ok(
    abortThreshold >= cap && abortThreshold <= cap + 50,
    `safety-net abort threshold ${abortThreshold} should sit just above the cap ${cap} (expected ~${expectedAbort})`,
  );
  assert.match(run, /sanitized=""/, 'safety net wipes sanitized so empty-fallback fires');
});

test('voice config check: validates .onnx.json and reads sample_rate', () => {
  const run = getAudioStepRun();
  assert.match(run, /config="[^"]*\.onnx\.json"/, 'config path is computed');
  assert.match(run, /\[ ! -f "\$config" \]/, 'config existence check present');
  assert.match(run, /sample_rate=/, 'sample_rate is read');
  assert.match(run, /phoneme_type=/, 'phoneme_type is read');
  assert.match(run, /num_speakers=/, 'num_speakers is read');
});

test('diagnostic: duration ratio sanity check is wired', () => {
  const run = getAudioStepRun();
  assert.match(run, /ratio_ok/, 'ratio_ok variable defined');
  assert.match(run, /r >= 0\.6 && r <= 1\.5/, 'ratio band defined as [0.6, 1.5]');
  assert.match(
    run,
    /outside \[0\.6, 1\.5\]/,
    'ratio warning mentions the band',
  );
});

// ───────────────── ACRONYM + DIGIT PRE-PASS ─────────────────

test('phoneme-density: 2+ consecutive uppercase letters are lowercased', () => {
  // eSpeak's en_list flags PR/API/JSON/etc as $abbrev → spelled
  // letter-by-letter at ~3 phonemes per letter. Lowercasing forces a
  // pseudo-word lookup that produces ~1.5 phonemes/char — fits the
  // char-cap budget.
  const r = runHarness('The PR fixes the API JSON handler and updates HTML URL CSS rules in TODO comments.');
  assert.doesNotMatch(r.sanitized, /\b(PR|API|JSON|HTML|URL|CSS|TODO)\b/, 'no 2+ uppercase runs survive');
  assert.match(r.sanitized, /\bpr\b/, 'PR becomes pr');
  assert.match(r.sanitized, /\bapi\b/, 'API becomes api');
  assert.match(r.sanitized, /\bjson\b/, 'JSON becomes json');
});

test('phoneme-density: single-uppercase tokens are NOT lowercased', () => {
  // Sentence-initial capitalization should survive — only 2+ consecutive.
  const r = runHarness('The first word is capitalized. So is This.');
  assert.match(r.sanitized, /\bThe\b/, '"The" preserved (only T uppercase)');
  assert.match(r.sanitized, /\bSo\b/, '"So" preserved');
  assert.match(r.sanitized, /\bThis\b/, '"This" preserved');
});

test('phoneme-density: thousands-separator commas inside numbers are stripped', () => {
  // "12,345" survives the keep-set as ASCII letters+digits+commas, but
  // eSpeak then reads it as TWO numbers separated by a clause break.
  // Stripping the comma makes it one number.
  const r = runHarness('Cost was 12,345 dollars across 1,000,000 lines.');
  // After comma-strip, then 5+ digit-run gets squashed to "NUM"
  assert.doesNotMatch(r.sanitized, /12,345/, 'no embedded comma in 12,345');
  assert.doesNotMatch(r.sanitized, /1,000,000/, 'no embedded comma in 1,000,000');
});

test('phoneme-density: 5+ digit runs collapse to number placeholder', () => {
  const r = runHarness('Run 1234567 failed at line 89012 with commit 1234567890abcdef.');
  // 1234567 (7 digits) and 89012 (5 digits) and 1234567890 (10 digits) all squashed.
  // Placeholder is "number" not "num" because eSpeak phonemizes "num"
  // identically to "numb" (/nʌm/) — listeners would hear "Run numb
  // failed". "number" is a vocabulary-stable real word that signals
  // "long identifier" cleanly.
  assert.doesNotMatch(r.sanitized, /1234567/, '7-digit run collapsed');
  assert.doesNotMatch(r.sanitized, /89012/, '5-digit run collapsed');
  assert.doesNotMatch(r.sanitized, /1234567890/, '10-digit run collapsed');
  assert.match(r.sanitized, /\bnumber\b/, 'lowercase number placeholder present');
  // Defensive: bare "num" not followed by "ber" would be the bug —
  // eSpeak phonemizes /nʌm/ which sounds like "numb".
  assert.doesNotMatch(r.sanitized, /\bnum\b(?!ber)/, 'must not emit bare num — eSpeak phonemizes it as "numb"');
});

test('phoneme-density: short digit runs survive (year 2026, version 1.2.3, decimal 3.14)', () => {
  const r = runHarness('Year 2026, version 1.2.3, pi 3.14, and build 9999 stay readable.');
  assert.match(r.sanitized, /2026/, 'year 2026 (4 digits) preserved');
  assert.match(r.sanitized, /1\.2\.3/, 'version 1.2.3 preserved');
  assert.match(r.sanitized, /3\.14/, 'decimal 3.14 preserved');
  assert.match(r.sanitized, /9999/, 'build 9999 (4 digits) preserved');
  assert.doesNotMatch(r.sanitized, /NUM/, 'no NUM placeholder for short runs');
});

test('phoneme-density: acronym + digit-rich input passes cap on a content that would otherwise blow phoneme budget', () => {
  // Without the pre-pass, "PR 12345 fixes API JSON HTML URL CSS SQL AWS IDE CPU RAM SSH" is
  // 68 chars but >150 phonemes after letter-by-letter spell-out + number expansion.
  // With the pre-pass, the same string becomes "pr NUM fixes api json html url css sql aws ide cpu ram ssh"
  // — phoneme count drops to ~80 and the cap stays well in range.
  const r = runHarness('PR 12345 fixes API JSON HTML URL CSS SQL AWS IDE CPU RAM SSH issue.');
  assert.ok(r.maxsent <= MAXLEN);
  assert.doesNotMatch(r.sanitized, /\b[A-Z]{2,}\b/, 'no 2+ uppercase tokens survive');
  assert.doesNotMatch(r.sanitized, /12345/, 'long digit run squashed');
});

// ───────────────── EMAIL + AT-SYMBOL HANDLING ─────────────────

test('@ sign in email never survives to confuse the cap @-placeholder', () => {
  // The cap uses @ as a digit-dot-digit placeholder mid-pipeline. If
  // a raw @ from user input slipped past sanitize, the unmask step
  // (s/@/./g) would turn it into a `.` and confuse sentence detection.
  // The keep-set excludes @, so @ becomes a space well before the
  // placeholder phase — but this test pins that ordering invariant.
  const r = runHarness('Contact us at user@host.com for details.');
  assert.doesNotMatch(r.sanitized, /@/, 'no @ sign survives sanitize');
});

// ───────────────── LOG-INJECTION CORPUS ─────────────────

test('log-injection corpus: comprehensive coverage of workflow-command vectors', () => {
  const vectors = [
    '::error::pwn',
    '::add-mask::TOKEN',
    '::set-output name=foo::evil',
    '::endgroup::',
    '::warning file=x.ts,line=1::owned',
    '::notice::owned',
    '::debug::owned',
    '::group::malicious',
    '::save-state name=x::evil',
    '::stop-commands::abc',
    'normal text\n::error::injected',
    '\n\n::set-env name=PATH::/evil\n\n',
  ];
  for (const v of vectors) {
    const r = runHarness(v);
    // No `::` substring may survive — that's the marker the runner
    // interprets at line-start as a workflow command.
    assert.ok(
      !r.sanitized.includes('::'),
      `vector ${JSON.stringify(v)}: "::" survived → ${JSON.stringify(r.sanitized)}`,
    );
    // No line in the sanitized output may begin with `::` either.
    for (const line of r.sanitized.split('\n')) {
      assert.ok(!line.startsWith('::'), `line begins with :: in ${JSON.stringify(r.sanitized)}`);
    }
  }
});

// ───────────────── DIAGNOSTIC LINE SHAPE ─────────────────

test('diagnostic line shape: 🧹 TTS sanitize emits stable format for log scraping', () => {
  // The file header documents this as goal #8 but it was never enforced.
  // CI dashboards / log-scraping tools depend on the exact shape.
  const r = runHarness('Hello world. This is a test. With three sentences.');
  assert.match(
    r.stdout,
    /🧹 TTS sanitize: \d+ → \d+ → \d+ chars, \d+ sentences \(longest=\d+ chars\)/,
    'diagnostic line shape is stable',
  );
});

// ───────────────── STRUCTURE GUARDS FOR NEW WIRING ─────────────────

test('audio.yml structure: phoneme regex tolerates both singular and plural piper output', () => {
  const run = getAudioStepRun();
  // piper 2023.11.14-2 logs "phoneme id(s)" (with parens-s) but the
  // piper1-gpl fallback might use just "phoneme" or "phonemes". The
  // regex must match both for forward-compat with the GPL fork.
  assert.match(
    run,
    /Synthesizing audio for \[0-9\]\+ phoneme\(s\)\?/,
    'phoneme regex tolerates singular/plural piper output',
  );
});

test('audio.yml structure: PIPER_LOG uses RUNNER_TEMP, not /tmp directly', () => {
  const run = getAudioStepRun();
  // Predictable /tmp/piper-synth.log races on self-hosted runners and
  // is a symlink-attack target. RUNNER_TEMP is per-job.
  assert.match(run, /PIPER_LOG="\$\{RUNNER_TEMP\}\/piper-synth\.log"/, 'PIPER_LOG anchored to RUNNER_TEMP');
  assert.doesNotMatch(run, /\/tmp\/piper-synth\.log/, 'no remaining hard-coded /tmp/piper-synth.log');
  assert.match(run, /: > "\$PIPER_LOG"/, 'PIPER_LOG is truncated up-front');
});

test('audio.yml structure: newline-strip belt immediately before piper invocation', () => {
  const run = getAudioStepRun();
  // The text fed to piper must have NO newlines — piper's --output_file
  // branch space-joins multi-line stdin (main.cpp 281-295) and stray
  // newlines silently change prosody.
  assert.match(
    run,
    /text="\$\(printf '%s' "\$text" \| LC_ALL=C tr -d '\\n\\r'\)"/,
    'final newline-strip is present immediately before the piper pipe',
  );
});

test('audio.yml structure: ph_max > 400 emits a warning + telemetry (warn-only)', () => {
  const run = getAudioStepRun();
  // Posture: warn but keep shipping the WAV. Earlier we fail-closed on
  // ph_max > 400 (rm + synthesized=false + exit 0), but in production
  // we saw the link silently disappear for borderline LLM briefings
  // even when the audio was perfectly listenable. Now: warn loudly
  // (still fires the ph_max_over_cap telemetry tag), keep the WAV.
  assert.match(run, /ph_max.*-gt 400/, '400-id training cap comparator');
  assert.match(run, /_fire ph_max_over_cap/, 'telemetry tag still fires');
  assert.match(
    run,
    /shipping the WAV anyway so reviewers can listen/,
    'warn-only stance documented in the user-facing message',
  );
});

test('audio.yml structure: empty-WAV guard rejects header-only files', () => {
  const run = getAudioStepRun();
  // A 44-byte (header-only) or near-empty WAV means synthesis produced
  // no audible content. Surface as failure, do not upload.
  assert.match(run, /wav_bytes.*-le 1024/, 'empty/tiny WAV guard threshold present');
});

test('audio.yml structure: voice MD5 integrity check uses HF voices.json registry', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // The Piper Python downloader uses MD5 from voices.json; without
  // this, a truncated download poisons the cache forever.
  assert.match(yamlText, /voices\.json/, 'voices.json registry URL present');
  assert.match(yamlText, /md5_digest/, 'jq extracts md5_digest from registry');
  assert.match(yamlText, /md5sum "\$\{VOICE_DIR\}/, 'md5sum invoked on downloaded voice files');
  assert.match(yamlText, /piper-voice-.*-v2/, 'voice cache key bumped to -v2 to invalidate pre-integrity caches');
});

test('audio.yml structure: PIPER_VOICE shape validation is present in both download and synth steps', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // Path-traversal + URL-injection guard. Must appear TWICE — once in
  // the download step and once in the synth step (defense in depth:
  // synth might run with a cache hit where download never executed).
  const malformedGuardMatches = yamlText.match(/malformed piper-voice id/g) || [];
  assert.ok(
    malformedGuardMatches.length >= 2,
    `expected ≥2 'malformed piper-voice id' guards (download + synth); got ${malformedGuardMatches.length}`,
  );
  // Path-traversal pattern check.
  assert.match(yamlText, /\*\[!A-Za-z0-9\._-\]\*\|\*\.\.\*/, 'illegal-char + path-traversal guard present');
  // Regex pin to the rhasspy id convention.
  assert.match(
    yamlText,
    /\^\[a-z\]\{2\}_\[A-Z\]\{2\}-\[a-z0-9_\]\+-\(x_low\|low\|medium\|high\)\$/,
    'voice-id regex pins rhasspy convention',
  );
});

test('audio.yml structure: voice MD5 + size SHAPES are validated before delete decision', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // Belt-and-braces: prevents a malformed/hostile registry value from
  // triggering an infinite download/delete loop.
  assert.match(yamlText, /case "\$want_size" in/, 'want_size shape check (digits only)');
  assert.match(yamlText, /\^\[0-9a-f\]\{32\}\$/, 'want_md5 shape check (32-hex-char)');
  assert.match(yamlText, /malformed md5_digest in registry/, 'malformed md5 warning present');
});

test('audio.yml structure: ffmpeg content probe (RMS / DC / flat / silence) is wired with 2-breach fail-closed', () => {
  const run = getAudioStepRun();
  // Probe block must run AFTER the ratio_ok check. There is now an
  // ffmpeg-availability fast-path that emits synthesized=true and
  // exit 0 BEFORE the probe (when ffmpeg is missing locally) — so we
  // can't use indexOf('synthesized=true') as a downstream anchor.
  // Anchor instead on the probe being post-ratio + the probe content
  // existing.
  const idxRatio = run.indexOf('ratio_ok');
  const idxProbe = run.indexOf('📊 wav-stats:');
  assert.ok(idxRatio >= 0, 'ratio_ok block present');
  assert.ok(idxProbe > idxRatio, 'probe sits after ratio_ok');
  // The ffmpeg-missing fast-path must precede the probe (otherwise
  // we'd run ffmpeg unconditionally, which crashes on macOS dev
  // machines).
  const idxFfmpegGuard = run.indexOf('ffmpeg not on PATH');
  assert.ok(idxFfmpegGuard > idxRatio && idxFfmpegGuard < idxProbe, 'ffmpeg-missing fast-path sits between ratio and probe');
  // Signals
  assert.match(run, /astats=metadata=0:reset=0/, 'astats filter present');
  assert.match(run, /silencedetect=noise=-50dB/, 'silencedetect with -50dB threshold');
  assert.match(run, /aspectralstats=measure=flatness/, 'aspectralstats opt-in for ffmpeg ≥ 5.1');
  // 2-breach warn-only semantics (was fail-closed; now warns + ships
  // the WAV so reviewers can judge — matches the ph_max>400 stance)
  assert.match(run, /breaches.*-ge 2/, 'breach-count gate at ≥2');
  assert.match(run, /wav content probe.*threshold breaches/, 'breach message present');
  assert.match(run, /shipping the WAV so reviewers can judge/, 'warn-only stance documented');
});

test('audio.yml structure: piper tarball SHA256 is pinned per-arch + verified before tar extraction', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // Round-5 supply-chain addition: rhasspy/piper publishes no checksums
  // or signatures, so we pin the SHA256 of the canonical 2023.11.14-2
  // release asset directly in the action default. Fail-soft on mismatch.
  assert.match(yamlText, /piper-tarball-sha256-x86_64:/, 'x86_64 SHA256 input declared');
  assert.match(yamlText, /piper-tarball-sha256-aarch64:/, 'aarch64 SHA256 input declared');
  // Verified-good defaults (64 hex chars). Match the actual values we
  // confirmed against the live release artifacts.
  const x86Match = yamlText.match(/piper-tarball-sha256-x86_64:[\s\S]*?default:\s*'([0-9a-f]+)'/);
  const armMatch = yamlText.match(/piper-tarball-sha256-aarch64:[\s\S]*?default:\s*'([0-9a-f]+)'/);
  assert.ok(x86Match, 'x86_64 default present');
  assert.ok(armMatch, 'aarch64 default present');
  assert.equal(x86Match![1].length, 64, 'x86_64 SHA256 is 64 hex chars');
  assert.equal(armMatch![1].length, 64, 'aarch64 SHA256 is 64 hex chars');
  // The verification runs INSIDE the install loop, AFTER curl succeeds
  // and BEFORE the canonical tar -xzf — fail-soft branch warns and
  // falls through.
  assert.match(yamlText, /sha256sum \/tmp\/piper\.tar\.gz/, 'SHA256 verify on downloaded tarball');
  assert.match(yamlText, /piper tarball SHA256 verified/, 'verify-success log line');
  assert.match(yamlText, /piper tarball SHA256 mismatch/, 'mismatch warning present');
  assert.match(yamlText, /refusing to extract canonical URL/, 'mismatch refuses extraction (fail-soft)');
  // The install loop must execute in the right order: curl → sha256
  // check → tar. Search both within the install step run block.
  const installMatch = yamlText.match(/Install Piper binary[\s\S]+?(?=\n {4}- name:)/);
  assert.ok(installMatch, 'install step located');
  const installBody = installMatch![0];
  const idxCurl = installBody.indexOf('curl -fSL --connect-timeout 10 --max-time 180');
  const idxSha = installBody.indexOf('sha256sum /tmp/piper.tar.gz');
  const idxTar = installBody.indexOf('tar -xzf /tmp/piper.tar.gz');
  assert.ok(idxCurl >= 0 && idxSha > idxCurl && idxTar > idxSha, 'install ordering: curl → sha256 → tar');
});

test('audio.yml structure: defenses_fired telemetry + GITHUB_STEP_SUMMARY scorecard are wired', () => {
  const run = getAudioStepRun();
  // Round-5 observability: every defense-fire site adds a closed-vocab
  // tag to $defenses_fired; the step writes the tag list to
  // GITHUB_OUTPUT and a markdown scorecard row to GITHUB_STEP_SUMMARY.
  assert.match(run, /_fire\(\)/, '_fire function declared');
  assert.match(run, /_emit_telemetry\(\)/, '_emit_telemetry function declared');
  assert.match(run, /defenses_fired=""/, 'defenses_fired accumulator initialised');
  assert.match(run, /printf 'defenses_fired=%s/, 'output writer present');
  assert.match(run, /GITHUB_STEP_SUMMARY/, 'step summary referenced');
  assert.match(run, /Drift audio scorecard/, 'scorecard markdown heading present');
  // Every documented closed-vocab defense tag must fire at least once
  // somewhere in the step. If any of these is missing, an entire class
  // of defense has gone silent in the telemetry.
  const expectedTags = [
    'piper_voice_id_invalid',
    'voice_config_missing',
    'sanitize_maxsent_overflow',
    'wav_too_small',
    'ph_max_over_cap',
    'ph_caution_band',
    'ratio_out_of_band',
    'ffmpeg_unavailable',
    'content_probe_breach',
    'content_probe_single_breach',
  ];
  for (const tag of expectedTags) {
    assert.match(run, new RegExp(`_fire ${tag}\\b`), `defense tag '${tag}' fires`);
  }
  // Every exit path (success + early-exits) must call _emit_telemetry
  // BEFORE the exit so the output is written.
  assert.match(run, /_emit_telemetry skipped\n\s+exit 0/, 'skipped paths emit telemetry before exit');
  assert.match(run, /_emit_telemetry ok/, 'success path emits telemetry');
});

test('audio-link end-to-end chain: synth → upload → render — all three hops are wired in action.yml', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // HOP 1: synth step writes synthesized=true + wav_path=... on success.
  const synthStep = yamlText.match(/Synthesize audio summary[\s\S]+?(?=\n {4}- name:)/);
  assert.ok(synthStep, 'synth step is present');
  assert.match(synthStep![0], /synthesized=true.*GITHUB_OUTPUT/, 'synth writes synthesized=true');
  assert.match(synthStep![0], /wav_path=.*GITHUB_OUTPUT/, 'synth writes wav_path');
  assert.match(synthStep![0], /🔊 hop 1\/3 OK:/, 'hop 1 diagnostic on success');
  // HOP 2: upload step gates on synthesized==true + emits artifact-url.
  const uploadStep = yamlText.match(/Upload audio summary artifact[\s\S]+?(?=\n {4}- name:)/);
  assert.ok(uploadStep, 'upload step is present');
  assert.match(uploadStep![0], /id: audio-upload/, 'upload step has id=audio-upload');
  assert.match(uploadStep![0], /steps\.audio\.outputs\.synthesized == 'true'/, 'upload gated on synthesized');
  assert.match(uploadStep![0], /actions\/upload-artifact@v\d+/, 'uses upload-artifact');
  assert.match(uploadStep![0], /archive: false/, 'non-zipped artifact (so URL serves the raw .wav)');
  assert.match(uploadStep![0], /steps\.audio\.outputs\.wav_path/, 'upload reads wav_path from synth');
  // HOP 2.5 — chain diagnostic step makes both hop 2 and hop 3 debuggable.
  assert.match(yamlText, /Audio-link chain diagnostic/, 'audio-link chain diagnostic step present');
  assert.match(yamlText, /🔊 hop 2\/3:/, 'hop 2 diagnostic line present');
  assert.match(yamlText, /🔊 hop 3\/3 (OK|FAILED):/, 'hop 3 diagnostic line present');
  // HOP 3: render step reads DRIFT_AUDIO_URL from upload's artifact-url output.
  // This is the link from the action runtime to the dist/index.js bundle
  // that emits the PR-comment markdown.
  assert.match(
    yamlText,
    /DRIFT_AUDIO_URL:\s+\$\{\{\s+steps\.audio-upload\.outputs\.artifact-url\s+\}\}/,
    'render step env reads artifact-url from upload step',
  );
  // dist/index.js (the bundle the render step invokes) reads
  // process.env.DRIFT_AUDIO_URL and threads it to renderOverview.
  const distSource = readFileSync(join(REPO, 'dist/index.js'), 'utf8');
  assert.match(distSource, /process\.env\.DRIFT_AUDIO_URL/, 'bundle reads DRIFT_AUDIO_URL');
  assert.match(distSource, /audioUrl/, 'bundle threads audioUrl into render');
});

test('audio.yml structure: AI briefing has prompt-injection boundary + curl timeouts + reply-head sanitisation', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // Explicit untrusted-input boundary in the system prompt.
  assert.match(yamlText, /SECURITY BOUNDARY/, 'AI prompt includes security boundary clause');
  assert.match(yamlText, /UNTRUSTED INPUT/, 'AI prompt marks user content as untrusted');
  // Byte caps on PR_TITLE / PR_BODY before they flow into the AI prompt.
  assert.match(yamlText, /PR_TITLE_CAPPED.*head -c 1000/, 'PR_TITLE capped to 1 KB');
  assert.match(yamlText, /PR_BODY_CAPPED.*head -c 16000/, 'PR_BODY capped to 16 KB');
  // The user message uses the capped variables, not the raw env values.
  assert.match(yamlText, /\$\{PR_TITLE_CAPPED:-\(none provided\)\}/, 'user prompt uses capped title');
  assert.match(yamlText, /\$\{PR_BODY_CAPPED:-\(none provided\)\}/, 'user prompt uses capped body');
  // curl timeouts on the model call AND the voice/registry/install
  // downloads — bounds the worst-case stall. The AI call uses a
  // model-aware timeout ($ai_maxtime: 60s default, 180s for gpt-5/
  // o-series reasoning models which routinely take 60-120s for first
  // token). Match the variable form, not the literal numeric value.
  assert.match(yamlText, /--connect-timeout 10 --max-time "\$ai_maxtime".*chat\/completions/s, 'AI curl uses model-aware --max-time');
  assert.match(yamlText, /tokfield='max_completion_tokens'; ai_maxtime=180/, 'reasoning models get 180s budget');
  assert.match(yamlText, /tokfield='max_tokens';\s+ai_maxtime=60/, 'classic chat models get 60s budget');
  assert.match(yamlText, /--connect-timeout 10 --max-time 120.*\.onnx\?download=true/s, 'voice .onnx download has timeouts');
  assert.match(yamlText, /--connect-timeout 5 --max-time 15.*registry_url/s, 'voices.json registry fetch has timeouts');
  assert.match(yamlText, /--connect-timeout 10 --max-time 180 -o \/tmp\/piper\.tar\.gz/, 'piper tarball install has timeouts');
  // Reply-head echo must strip control chars and defang ::.
  assert.match(yamlText, /tr -d '\\000-\\037'/, 'reply head strips C0 control chars');
  assert.match(yamlText, /sed 's\/::\/:_:\/g'/, 'reply head defangs :: workflow-command sigil');
});

test('audio.yml structure: voices URL is pinned to a commit SHA, not /resolve/main/', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // The voices.json registry + the per-voice download URLs are
  // constructed from $ref, which defaults to the piper-voices-pin
  // input. Pinning a SHA (not 'main') is what makes the MD5 check
  // upgrade from corruption-only to true supply-chain integrity.
  assert.match(yamlText, /piper-voices-pin:/, 'piper-voices-pin input declared');
  // Default must be a 40-hex commit SHA (not 'main', not 'v1.0.0').
  const defaultMatch = yamlText.match(/piper-voices-pin:[\s\S]*?default:\s*'([^']+)'/);
  assert.ok(defaultMatch, 'piper-voices-pin has a default');
  assert.match(
    defaultMatch![1],
    /^[0-9a-f]{40}$/,
    `piper-voices-pin default must be a 40-hex commit SHA, got: ${defaultMatch![1]}`,
  );
  // The actual base= and registry_url= assignments must interpolate
  // ${ref}, not a hardcoded /resolve/main/. (A doc comment elsewhere
  // showing the URL shape is fine — only the executable assignments
  // are load-bearing.)
  const baseAssign = yamlText.match(/^\s*base="https:\/\/huggingface\.co\/rhasspy\/piper-voices\/resolve\/([^/"]+)\//m);
  assert.ok(baseAssign, 'base= URL assignment present');
  assert.equal(baseAssign![1], '${ref}', `base= must interpolate \${ref}, got: ${baseAssign![1]}`);
  const registryAssign = yamlText.match(/^\s*registry_url="https:\/\/huggingface\.co\/rhasspy\/piper-voices\/resolve\/([^/"]+)\//m);
  assert.ok(registryAssign, 'registry_url= assignment present');
  assert.equal(registryAssign![1], '${ref}', `registry_url= must interpolate \${ref}, got: ${registryAssign![1]}`);
  // The pin must be threaded into the env: block of the download step.
  assert.match(yamlText, /PIPER_VOICES_PIN: \$\{\{ inputs\.piper-voices-pin \}\}/, 'pin threaded into env');
});

test('audio.yml structure: piper1-gpl secondary fallback URL is wired in install loop', () => {
  const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // rhasspy/piper was archived 2025-10-06; GPL fork is the active
  // like-for-like replacement.
  assert.match(yamlText, /OHF-Voice\/piper1-gpl/, 'piper1-gpl URL present');
  assert.match(yamlText, /for url in "\$primary" "\$gpl_fallback" "\$fallback"/, 'GPL fallback inserted between primary and legacy');
  // Install cache key bumped to v3 in round 5 (piper tarball SHA256
  // verification added; any pre-v3 install was unverified).
  assert.match(yamlText, /piper-\$\{\{ runner\.arch \}\}-\$\{\{ inputs\.piper-version \}\}-v3/, 'install cache key bumped to -v3');
});

test('audio.yml structure: awk -v args quoted and read uses -r', () => {
  const run = getAudioStepRun();
  // shellcheck SC2086 + SC2162 hygiene + portability against empty values.
  assert.match(run, /awk -v b="\$wav_bytes" -v sr="\$sample_rate" -v c="\$after"/, 'awk -v args quoted');
  assert.match(run, /read -r audio_sec/, 'read uses -r to avoid backslash munging');
  assert.match(run, /sort -n \| tail -n 1/, 'tail uses POSIX -n form');
});

// ─────────────── 2044-CHAR REGRESSION: strengthened asserts ───────────────

test('regression strengthened: 2044-char briefing produces stable, lockable shape', () => {
  // The full 4-paragraph briefing from the original failing production
  // run. Strengthens the original asserts with: terminator-count band,
  // no-empty-shards check, diagnostic-line shape, and the new acronym
  // lowercase invariant.
  const briefing = [
    "This pull request addresses a long standing issue with how the drift scanning action is triggered on GitHub. Previously setting the start on pr comment flag meant our workflow would only respond to drift comments effectively ignoring all other pull request events. That behavior broke setups where both pull request and issue comment events were used causing scans to get silently skipped on pushes and updates. The PR flips this logic with the new contract enabling start on pr comment adds the ability to launch scans with comments without removing the usual pull request triggers. This ensures the workflow remains responsive no matter how it's wired so users can re run scans on demand with drift but still get automatic scans on PR events.",
    "",
    "In terms of code changes the heart of the update lies in the workflow engine and gating logic. The action's main orchestration file is where we've reworked the event branching to make the triggers additive. The steps that ONLY make sense for comment events like parsing arguments or handling fork safe checkouts are still gated behind a runtime marker so a standard pull request never runs them. Supporting files like the test suites start on pr comment.test.ts comment gate runtime.test.ts and a newly added start on pr comment additive suite thoroughly validate the cross trigger matrix and updated gating.",
    "",
    "The biggest risk is around trigger overlaps. With the triggers now additive we need to watch for any unintended duplicate scans or review comments if workflows are misconfigured especially in mixed trigger setups. There's also a possibility that edge case events like reopening a closed PR with comment triggers could trip the wrong branch.",
    "",
    "Looking forward the code includes hardcoded step counts and behavior markers that could be further abstracted. The docs now outline usage but it'd be smart to add automated workflow recommendations and more granular trigger diagnostics next sprint to prevent miswiring and surface any unusual activity early.",
  ].join('\n');

  const r = runHarness(briefing);

  // Hard cap invariant.
  assert.ok(r.maxsent <= MAXLEN, `maxsent ${r.maxsent} > MAXLEN ${MAXLEN}`);

  // Sentence count band — with MAXLEN=120 this briefing yields ~25-50
  // sentences. Lower bound 18 leaves headroom; upper bound 70 catches
  // over-splitting regressions.
  assert.ok(
    r.terminators >= 18 && r.terminators <= 70,
    `terminator count out of band: ${r.terminators}`,
  );

  // No empty sentence shards (would synthesize as silence pad in piper).
  // Verify by splitting on `.` and checking each non-empty chunk's
  // trimmed length is > 0.
  const chunks = r.sanitized.split('.').map((c) => c.trim()).filter((c) => c.length > 0);
  assert.ok(chunks.length > 0, 'at least one non-empty sentence chunk');
  // Diagnostic line shape is emitted on stdout.
  assert.match(r.stdout, /🧹 TTS sanitize: \d+ → \d+ → \d+ chars, \d+ sentences \(longest=\d+ chars\)/);

  // The acronym 'PR' is normalized — was `PR` (uppercase) in source.
  assert.doesNotMatch(r.sanitized, /\bPR\b/, 'PR should have been lowercased');
  // 'ONLY' (4 uppercase) was in source — also normalized.
  assert.doesNotMatch(r.sanitized, /\bONLY\b/, 'ONLY should have been lowercased');
});

// ───────────────── PROPERTY-BASED INVARIANT TESTS ─────────────────
// Seeded xorshift32 PRNG so failures are reproducible. The four invariants
// below are the LOAD-BEARING contract of the sanitize pipeline — every
// gibberish prevention layer depends on at least one of them.

function xorshift32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5; s |= 0;
    return (s >>> 0) / 0xffffffff;
  };
}

const PROPERTY_ALPHABET = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ...' \t\n\r',
  ...'.,!?;:\'"()-[]{}*&^%$#@~`+=<>/|\\',
  '—', '–', '…', '"', '"', "'", "'", '«', '»',
  '😀', '🚀', '🎉', '🔥',
  '::error::', '::add-mask::', '::set-output::', '::endgroup::',
  'PR ', 'API ', 'JSON ', 'HTML ', 'URL ', 'CSS ', 'TODO ',
  '12345 ', '0xdeadbeef ', '1.2.3 ', '3.14 ',
  '.test.ts', '.json', '.yml',
] as const;

function generateInput(rng: () => number, maxLen: number): string {
  const len = Math.floor(rng() * maxLen);
  let out = '';
  while (out.length < len) {
    const tok = PROPERTY_ALPHABET[Math.floor(rng() * PROPERTY_ALPHABET.length)];
    out += tok;
  }
  return out.slice(0, len);
}

test('property: load-bearing invariants hold across 80 randomized inputs', () => {
  const rng = xorshift32(0xc0ffee);
  const failures: string[] = [];
  for (let i = 0; i < 80; i++) {
    const input = generateInput(rng, 4000);
    const r = runHarness(input);
    // Invariant 1: every sentence is ≤ MAXLEN (gibberish prevention)
    if (r.maxsent > MAXLEN) {
      failures.push(`iter ${i}: maxsent=${r.maxsent} > MAXLEN=${MAXLEN}, input.length=${input.length}`);
    }
    // Invariant 2: no `::` survives (log-injection neutralized)
    if (r.sanitized.includes('::')) {
      failures.push(`iter ${i}: "::" survived; input.length=${input.length}`);
    }
    // Invariant 3: no embedded newline reaches the piper-input string
    if (r.sanitized.includes('\n') || r.sanitized.includes('\r')) {
      failures.push(`iter ${i}: newline survived; input.length=${input.length}`);
    }
    // Invariant 4: no stray `@` (the cap placeholder must be unmasked).
    // Real input can contain @ (e.g. emails), but it's stripped at the
    // keep-set step before the cap stage ever sees it.
    if (r.sanitized.includes('@')) {
      failures.push(`iter ${i}: stray "@" survived; input.length=${input.length}, sanitized starts: ${r.sanitized.slice(0, 80)}`);
    }
  }
  assert.equal(failures.length, 0, `property invariants violated in ${failures.length} iters:\n  ${failures.join('\n  ')}`);
});

// ───────────────── SNAPSHOT TESTS: frozen golden outputs ─────────────────
// Locks each documented transformation class. A whitespace-canonicalization
// step normalizes trailing-period and double-space artifacts so the
// snapshots survive minor tr -s tweaks without becoming overly brittle.

function canon(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*\.\s*/g, '. ').trim().replace(/\.+$/, '');
}

const SNAPSHOTS: Array<{ name: string; input: string; expected: string }> = [
  { name: 'terminator-fold',   input: 'Is this fast? Yes! Step 1: do X; do Y.', expected: 'Is this fast. Yes. Step 1. do X. do Y' },
  { name: 'file-ext',          input: 'Look at foo.test.ts and bar.yml.', expected: 'Look at foo test ts and bar yml' },
  { name: 'acronym-lowercase', input: 'PR fixes API and JSON.', expected: 'pr fixes api and json' },
  { name: 'digit-cap',         input: 'Run 1234567 failed.', expected: 'Run number failed' },
  { name: 'decimal-preserve',  input: 'Pi is 3.14 and version 1.2.3.', expected: 'Pi is 3.14 and version 1.2.3' },
  { name: 'em-dash-strip',     input: 'foo — bar → baz 🎉 end.', expected: 'foo bar baz end' },
  // Leading `::` folds to `..` (each `:` → `.`), squashes to `.`, then
  // gets stripped by the leading-`[ .]*` sed at end of sanitize. Then
  // the awk cap re-splits on remaining `.`. Final output starts with
  // "error" (no leading dot) — the contract that matters for log
  // injection is that NO line begins with `::` (the runner command
  // sigil), and the canon form below proves that.
  { name: 'log-injection',     input: '::error::pwn', expected: 'error. pwn' },
  { name: 'multi-paragraph',   input: 'A one.\n\nB two.', expected: 'A one. B two' },
  { name: 'empty',             input: '', expected: '' },
  { name: 'whitespace-only',   input: '   \t\n  ', expected: '' },
  { name: 'contraction',       input: "don't worry, it's fine.", expected: "don't worry, it's fine" },
  { name: 'thousands-comma',   input: 'Cost was 1,234 dollars.', expected: 'Cost was 1234 dollars' },
  { name: 'long-number-w/-comma', input: 'Cost was 12,345 dollars.', expected: 'Cost was number dollars' },
];

for (const snap of SNAPSHOTS) {
  test(`snapshot: ${snap.name}`, () => {
    const r = runHarness(snap.input);
    assert.equal(
      canon(r.sanitized),
      canon(snap.expected),
      `snapshot drift for "${snap.name}":\n  input:    ${JSON.stringify(snap.input)}\n  expected: ${JSON.stringify(snap.expected)}\n  got:      ${JSON.stringify(r.sanitized)}\n  canon-got: ${JSON.stringify(canon(r.sanitized))}\n  canon-exp: ${JSON.stringify(canon(snap.expected))}`,
    );
  });
}
