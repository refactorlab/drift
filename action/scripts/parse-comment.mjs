#!/usr/bin/env node
// parse-comment.mjs — extract Drift overrides from a PR comment body.
//
// Invoked by examples/drift-on-comment.yml. Two forms are accepted:
//
//   1. One-liner key=value pairs after `/drift`:
//        /drift debug=true ai-model=openai/gpt-5
//
//   2. Fenced YAML block following `/drift`:
//        /drift
//        ```yaml
//        debug: true
//        ai-model: openai/gpt-5
//        ```
//
// Precedence: one-liner > fenced YAML (so a quick override beats whatever's
// in the block). Unknown keys log a ::warning:: and are dropped — forward-
// compatible against adding new inputs to action.yml without breaking older
// /drift comments.
//
// Reads:  process.env.COMMENT_BODY (raw comment text)
// Writes: $GITHUB_OUTPUT (one line per allowed key)
//
// SECURITY: never echo or eval COMMENT_BODY in shell. Everything stays in
// process memory; output values are line-sanitized before write so a
// crafted comment can't smuggle extra $GITHUB_OUTPUT lines.

import { appendFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

// Keys settable from a /drift comment. MUST be a subset of inputs in
// action.yml — anything else is ignored with a warning.
const ALLOWED = new Set([
  'debug',
  'progress',
  'ai-suggestions',
  'audio-summary',
  'ai-model',
  'fail-threshold',
  'ai-max-suggestions',
  'profiler-release-tag',
  'piper-voice',
]);

const body = process.env.COMMENT_BODY ?? '';
const githubOutput = process.env.GITHUB_OUTPUT;

const parsed = {};

// Pass 1: fenced YAML block — first ```yaml / ```yml block in the comment.
const fenceRe = /```ya?ml\s*\n([\s\S]*?)\n```/m;
const fence = body.match(fenceRe);
if (fence) {
  try {
    const obj = parseYaml(fence[1]);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) parsed[k] = v;
    } else {
      console.log('::warning::Fenced YAML block in /drift comment did not parse to a mapping; ignoring.');
    }
  } catch (e) {
    console.log(`::warning::Could not parse fenced YAML in /drift comment: ${e.message}`);
  }
}

// Pass 2: one-liner. Look at the first non-empty line that starts with /drift.
const lines = body.split(/\r?\n/);
let commandLine = '';
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('/drift')) {
    commandLine = trimmed;
    break;
  }
}
const afterCmd = commandLine.replace(/^\/drift\s*/, '');
if (afterCmd) {
  for (const tok of afterCmd.split(/\s+/).filter(Boolean)) {
    const eq = tok.indexOf('=');
    if (eq < 1) continue;
    const k = tok.slice(0, eq);
    const v = tok.slice(eq + 1);
    parsed[k] = v;
  }
}

// Emit $GITHUB_OUTPUT lines, dropping unknown keys with a warning.
const out = [];
for (const [k, v] of Object.entries(parsed)) {
  if (!ALLOWED.has(k)) {
    console.log(`::warning::Ignoring unknown /drift arg: ${k}`);
    continue;
  }
  // Coerce + sanitize: $GITHUB_OUTPUT is line-oriented; CR/LF in a value
  // would inject extra outputs. Everything we accept is a scalar; spaces
  // collapse newlines into one.
  const safe = String(v).replace(/[\r\n]+/g, ' ').trim();
  out.push(`${k}=${safe}`);
}

if (githubOutput && out.length > 0) {
  appendFileSync(githubOutput, out.join('\n') + '\n');
}

// For local debugging / `act` runs without $GITHUB_OUTPUT: dump to stdout.
if (!githubOutput) {
  console.log(out.join('\n'));
}
