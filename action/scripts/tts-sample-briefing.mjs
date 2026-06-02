// Emit a realistic, spoken-style PR-handover briefing of ~WORDS words to
// stdout — used by tts-local.sh to exercise the TTS pipeline at a target
// length (e.g. WORDS=300, WORDS=500) without needing a live PR.
const target = Number(process.env.WORDS || 300);
const sentences = [
  'In this pull request we replaced the piper text to speech engine with kokoro.',
  'The synthesis now runs through the self contained sherpa onnx binary, so there is no python dependency.',
  'We kept the text sanitizer and the audio validation gates that guard against garbled output.',
  'We dropped the piper only tuning knobs because kokoro does its own sentence chunking internally.',
  'The spoken summary uses the af heart voice at twenty four kilohertz.',
  'Reviewers can listen to the handover directly from the pull request comment.',
  'The model is cached across runs, so a warm run only pays the synthesis time.',
  'The change is fully fail soft and never blocks the review when audio is unavailable.',
  'We also updated the contract tests and the chrome extension parser to match the new wording.',
  'The duration ratio check and the content probe still run exactly as before.',
];
const out = [];
let words = 0;
for (let i = 0; words < target; i++) {
  const s = sentences[i % sentences.length];
  out.push(s);
  words += s.split(/\s+/).length;
}
process.stdout.write(out.join(' ') + '\n');
