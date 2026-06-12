// Grounding for the live voice agent: turn the PR's parsed scan (the same
// DriftReport the chat grounds on) into a compact, spoken-friendly system prompt
// for the local Claude brain. Pure + React-free so it unit-tests in plain node.

import type { DriftReport, MetricLevel, PrContext } from './types';
import type { FileDiff } from './prDiff';

/** The literal refusal string — small models follow a quoted string far better
 *  than an abstract instruction, and the UI can detect it verbatim. */
export const REFUSAL = "That's not in the scan.";

/**
 * How Andy must verbalize file paths, extensions, and acronyms — spoken the way a
 * developer would say them aloud, NOT read character-by-character. Shared by both the
 * phone-call and browser-voice prompts (both are read by a TTS engine). The worked
 * example is load-bearing: small TTS-driven models copy a concrete before/after far
 * more reliably than an abstract instruction.
 */
export const SPOKEN_PATH_RULE =
  'Say file paths the way a developer says them aloud, never character-by-character: name each folder, then read the extension as its language. For example, for "pkg/volley_core.js" say "the volley core JavaScript file in the package directory" — never "p-k-g slash volley underscore core dot j-s". Pronounce acronyms the way developers do: JSON as "Jason", SQL as "sequel", and ones like API, CSS, and URL spelled out letter by letter. Skip the extension on lockfiles and config files unless asked.';

function gaugeDisplay(report: DriftReport, key: string): string | null {
  return report.gauges.find((g) => g.key === key)?.display ?? null;
}

const LEVEL_RANK: Record<MetricLevel, number> = { critical: 0, moderate: 1, low: 2, unknown: 3 };

/**
 * Serialize the report into a severity-ordered labeled list (NOT JSON — small
 * models ground better on prose). Caps the noisy parts so the pinned context
 * stays small. Returns "" when there's no scan data to ground on.
 */
export function serializeScan(ctx: PrContext): string {
  const { pr, report } = ctx;
  const lines: string[] = [];

  const title = pr.title?.trim();
  lines.push(`PR: ${pr.owner}/${pr.repo} #${pr.number}${title ? ` — ${title}` : ''}`);

  if (!report.found) {
    // No parsed Drift comment — we still know which PR, but have no findings.
    lines.push('No scan report is available for this PR yet.');
    return lines.join('\n');
  }

  if (report.verdictLabel) {
    lines.push(`Verdict: ${report.verdictLabel}${report.effortLabel ? ` (${report.effortLabel})` : ''}`);
  }
  if (report.mergeConfidence) {
    lines.push(`Merge confidence: ${report.mergeConfidence.value} out of ${report.mergeConfidence.outOf}`);
  }

  const headline = (['drift', 'risks', 'suggestions'] as const)
    .map((k) => {
      const d = gaugeDisplay(report, k);
      return d ? `${k[0].toUpperCase()}${k.slice(1)}: ${d}` : null;
    })
    .filter(Boolean);
  if (headline.length) lines.push(headline.join(' | '));

  if (report.criticalCount != null && report.metricCount != null) {
    lines.push(
      `${report.criticalCount} critical of ${report.metricCount} metrics` +
        (report.blastRadius != null ? ` | blast radius ${report.blastRadius}` : ''),
    );
  }

  // Worst metrics first, capped — these are what the listener will ask about.
  const metrics = report.sections
    .flatMap((sec) => sec.metrics.map((m) => ({ ...m, section: sec.title })))
    .filter((m) => m.level === 'critical' || m.level === 'moderate')
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 8);
  if (metrics.length) {
    lines.push('Notable metrics (worst first):');
    for (const m of metrics) {
      const pct = m.percent != null ? `, ${m.percent}%` : '';
      const dir = m.direction === 'up' ? ' up' : m.direction === 'down' ? ' down' : '';
      lines.push(`- ${m.name} (${m.section}): ${m.level}${pct}${dir}`);
    }
  }

  return lines.join('\n');
}

/** Human-readable status word for the spoken-friendly file list. */
const STATUS_WORD: Record<FileDiff['status'], string> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'type-changed',
};

// How much of the diff we inline as pinned context. Sized for prompt caching: the
// whole block is stable across turns, so it's cached after turn 1 and cheap to
// reprefill. The OLD 200-line cap is what made Andy "stop at 6k" — he only saw a
// sliver of a 59-file PR. We budget by CHARS (≈ chars/4 tokens) so it bounds the
// real token cost, well within Opus's 200k window. (For PRs larger than this,
// step 2 lets Andy Read the rest from a workspace on demand.)
export const VOICE_DIFF_MAX_FILES = 200; // file LIST cap (the list is cheap — list nearly all)
export const VOICE_DIFF_CHAR_BUDGET = 140_000; // ~35k tokens of hunk body, total
export const VOICE_DIFF_PER_FILE_CHARS = 40_000; // ~10k tokens per file, so one giant file can't eat it all

// Low-signal = generated/vendored/minified files. They're still LISTED (Andy can
// name them) but their hunks are deprioritized to the end of the budget so a huge
// committed bundle / lockfile can't starve the real human changes (the #1 thing a
// reviewer actually asks about). Matches the worst offenders by path.
const LOW_SIGNAL_RE =
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.ya?ml|bun\.lockb?|composer\.lock|Cargo\.lock|Gemfile\.lock|poetry\.lock|go\.sum)$|\.(min\.(js|css)|map|wasm|snap)$|(^|\/)(dist|build|out|vendor|node_modules|coverage|\.next)\/|\.(generated|gen)\.|\.pb\.go$|_pb2\.py$/;
export function isLowSignalPath(path: string): boolean {
  return LOW_SIGNAL_RE.test(path);
}

/**
 * Serialize the PR's `pr_diff` (the literal changed files + +/- hunks) into the
 * spoken-grounding text. This is the per-scan source of truth for the live voice
 * agent: it answers about the ACTUAL code change, not the metrics report. Human-
 * relevant files come first (those drive the conversation) ahead of generated
 * bundles, and the hunks are char-budgeted (with a per-file cap) so the pinned
 * context is generous but bounded. Pure → testable.
 */
export function serializeDiff(ctx: PrContext): string {
  const { pr, prDiff } = ctx;
  const lines: string[] = [];

  const title = pr.title?.trim();
  lines.push(`PR: ${pr.owner}/${pr.repo} #${pr.number}${title ? ` — ${title}` : ''}`);

  const files = prDiff?.files ?? [];
  if (!files.length) {
    lines.push('No code diff is available for this PR scan.');
    return lines.join('\n');
  }

  // Biggest changes first — those drive the conversation.
  const ordered = [...files].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));
  const totalAdds = files.reduce((n, f) => n + f.additions, 0);
  const totalDels = files.reduce((n, f) => n + f.deletions, 0);
  lines.push(
    `${files.length} changed file(s), +${totalAdds} −${totalDels} lines` +
      (prDiff?.truncated ? ' (diff truncated)' : ''),
  );

  // 1. Compact changed-files list (largest first; list nearly all — it's cheap).
  lines.push('Changed files (largest first):');
  for (const f of ordered.slice(0, VOICE_DIFF_MAX_FILES)) {
    const path = f.oldPath && f.oldPath !== f.path ? `${f.oldPath} → ${f.path}` : f.path;
    const tags = [STATUS_WORD[f.status] ?? f.status, `+${f.additions} −${f.deletions}`];
    if (f.binary) tags.push('binary');
    if (isLowSignalPath(f.path)) tags.push('generated');
    lines.push(`- ${path} (${tags.join(', ')})`);
  }
  if (ordered.length > VOICE_DIFF_MAX_FILES) {
    lines.push(`…and ${ordered.length - VOICE_DIFF_MAX_FILES} more file(s).`);
  }

  // 2. The literal +/- changes. Emit human-relevant files first, generated files
  //    last, each char-budgeted (per-file cap + a global cap) so real changes are
  //    never starved by a committed bundle.
  const emitOrder = [
    ...ordered.filter((f) => !isLowSignalPath(f.path)),
    ...ordered.filter((f) => isLowSignalPath(f.path)),
  ];
  let budget = VOICE_DIFF_CHAR_BUDGET;
  let trimmed = false;
  const body: string[] = [];
  for (const f of emitOrder) {
    if (budget <= 0) {
      trimmed = true;
      break;
    }
    if (!f.hunks.length) continue;
    const fileCap = Math.min(budget, VOICE_DIFF_PER_FILE_CHARS);
    let spent = 0;
    let fileTrim = false;
    const fileBody: string[] = [`--- ${f.path}${isLowSignalPath(f.path) ? ' (generated)' : ''} ---`];
    spent += fileBody[0].length + 1;
    for (const h of f.hunks) {
      if (spent >= fileCap) {
        fileTrim = true;
        break;
      }
      fileBody.push(h.header);
      spent += h.header.length + 1;
      for (const ln of h.lines) {
        if (spent >= fileCap) {
          fileTrim = true;
          break;
        }
        const sign = ln.type === 'add' ? '+' : ln.type === 'del' ? '−' : ' ';
        const text = `${sign}${ln.text}`;
        fileBody.push(text);
        spent += text.length + 1;
      }
    }
    if (fileTrim) {
      fileBody.push('… (file trimmed)');
      trimmed = true;
    }
    body.push(...fileBody);
    budget -= spent;
  }
  if (body.length) {
    lines.push('Code changes:');
    lines.push(...body);
    if (trimmed) lines.push('… (diff trimmed to fit the context — ask about a file by name for more)');
  }

  return lines.join('\n');
}

/**
 * Serialize the {@link ReviewBrief} (+ the report's merge-readiness headline) into
 * spoken-friendly grounding for the PHONE call. This is the reviewer-facing layer
 * the diff alone can't answer: verdict, top risks, code-review suggestions, test
 * gaps, scope, and value. Worst/most-actionable items first; every section is
 * already capped by the builder. Returns "" when there's nothing to ground on.
 */
/** "Author: Alice" / "Authors: Alice and Bob" / "Authors: Alice, Bob, and 2 others". */
function authorLine(authors: string[]): string {
  const shown = authors.slice(0, 3);
  const more = authors.length - shown.length;
  const label = authors.length === 1 ? 'Author' : 'Authors';
  let names: string;
  if (shown.length === 1) names = shown[0];
  else if (shown.length === 2 && more === 0) names = `${shown[0]} and ${shown[1]}`;
  else names = shown.join(', ') + (more > 0 ? `, and ${more} other${more === 1 ? '' : 's'}` : '');
  return `${label}: ${names}`;
}

export function serializeReviewBrief(ctx: PrContext): string {
  const { report, reviewBrief: b } = ctx;
  const lines: string[] = [];

  // Who wrote it — the first thing a reviewer wants to know.
  if (b?.authors?.length) lines.push(authorLine(b.authors));

  // Merge-readiness headline — from the parsed report (always available).
  if (report.found) {
    if (report.verdictLabel) {
      lines.push(`Verdict: ${report.verdictLabel}${report.effortLabel ? ` (${report.effortLabel})` : ''}`);
    }
    if (report.mergeConfidence) {
      lines.push(`Merge confidence: ${report.mergeConfidence.value} out of ${report.mergeConfidence.outOf}`);
    }
    if (b?.qualityBand) lines.push(`Quality band: ${b.qualityBand}`);
    const drift = report.gauges.find((g) => g.key === 'drift')?.display;
    if (drift) lines.push(`Overall drift: ${drift}`);
    const crit = report.sections
      .flatMap((s) => s.metrics)
      .filter((m) => m.level === 'critical')
      .map((m) => m.name);
    if (crit.length) lines.push(`Critical metrics: ${crit.slice(0, 5).join(', ')}`);
  }

  if (b) {
    if (b.description) lines.push(`What the author says it does: ${b.description}`);
    if (b.businessSummary) lines.push(`What it does (inferred from the code): ${b.businessSummary}`);
    if (b.counts?.length) lines.push(`Change makeup: ${b.counts.join(', ')}`);

    if (b.risks?.length) {
      lines.push('Flagged risks (most important first):');
      for (const r of b.risks) {
        const q =
          r.quadrant === 'act_before_merge'
            ? ' [act before merge]'
            : r.quadrant === 'monitor_closely'
              ? ' [monitor closely]'
              : '';
        lines.push(`- ${r.label}${q}`);
      }
    }
    if (b.suggestions?.length) {
      lines.push('Code-review suggestions (highest severity first):');
      for (const s of b.suggestions) {
        const loc = s.line ? `${s.file}:${s.line}` : s.file;
        const sev = s.severity ? `${s.severity}: ` : '';
        lines.push(`- ${loc} — ${sev}${s.why}`);
      }
    }
    if (b.keyFiles?.length) {
      lines.push('Key files to review first:');
      for (const f of b.keyFiles) lines.push(`- ${f}`);
    }
    if (b.uncoveredRoots?.length) lines.push(`Untested entry points: ${b.uncoveredRoots.join(', ')}`);
    if (b.reliabilityGaps?.length) {
      lines.push('Reliability / edge-case gaps:');
      for (const g of b.reliabilityGaps) lines.push(`- ${g}`);
    }
    if (b.techDebt?.length) lines.push(`Maintainability hotspots: ${b.techDebt.join('; ')}`);
    if (b.duplication) lines.push(`Duplicate-code clusters: ${b.duplication}`);
    if (b.affectedRoots?.length) lines.push(`Areas this change reaches: ${b.affectedRoots.join(', ')}`);
    if (b.unreachableChanges?.length) {
      lines.push(`Possibly unused / unreached changes: ${b.unreachableChanges.join(', ')}`);
    }
    if (b.valueBottomLine) lines.push(`Value versus cost: ${b.valueBottomLine}`);
    if (b.commits?.length) lines.push(`Commits: ${b.commits.join('; ')}`);
  }

  return lines.join('\n');
}

/**
 * The full system prompt for a turn. The mic conversation grounds ONLY on the
 * PR's code diff (`pr_diff`) — never the metrics report — so a context with no
 * diff yields a "run a live scan first" persona instead of grounding text.
 */
export function buildVoiceSystemPrompt(ctx: PrContext | null): string {
  const rules = [
    'You are Andy, a hands-free voice assistant for reviewing ONE GitHub pull request.',
    "You are looking at the PR's code diff: the changed files and their added/removed lines.",
    'Your spoken reply is read aloud by a speech engine, so follow these rules exactly:',
    `1. Ground every answer in the PR's diff. If something is not in the diff at all, say exactly: "${REFUSAL}"`,
    '2. Never invent a file, line, change, or number that is not in the diff.',
    '3. Answer in 1 to 3 short spoken sentences. No markdown, no lists, no code, no symbols.',
    '4. Speak naturally — say "fifty-five percent", not "55%".',
    `5. ${SPOKEN_PATH_RULE}`,
    '6. Ask at most one short follow-up question, and only when it is genuinely needed.',
  ].join('\n');

  if (!ctx?.prDiff?.files?.length) {
    const why = ctx
      ? 'No code diff is loaded for this pull request. Tell the user to run a live scan first so you can discuss the changes.'
      : 'No pull request is loaded. Tell the user to open a PR and run a live scan first.';
    return `${rules}\n\n=== DIFF ===\n${why}\n=== END ===`;
  }
  return `${rules}\n\n=== DIFF (your only source of truth) ===\n${serializeDiff(ctx)}\n=== END ===`;
}

/**
 * The `outboundInstruction` for a Dial PHONE call. Same grounding (the PR diff),
 * but the persona differs: Dial runs the whole call end-to-end (it greets, listens,
 * and replies), so the instruction is the agent's standing brief for the entire
 * conversation rather than a per-turn system prompt. It opens the call, then answers
 * questions — strictly from the diff. With no diff loaded it tells the caller to run
 * a live scan first.
 */
export function buildCallInstruction(ctx: PrContext | null): string {
  const prRef = ctx ? `${ctx.pr.owner}/${ctx.pr.repo} #${ctx.pr.number}` : 'a GitHub pull request';
  const rules = [
    `You are Andy, an AI assistant calling to walk someone through the review of ${prRef} over the phone.`,
    'You are speaking on a live phone call. Be warm, concise, and natural.',
    'Open the call: greet the person, say you are Andy calling about the pull request, give a one-sentence summary of what changed, who wrote it, and whether it looks ready to merge, then ask what they would like to dig into.',
    "Ground EVERY answer in the review brief and the PR's code diff below.",
    'You can speak to all of it: what the change does and why, how risky it is and whether to merge, the top risks, specific code-review suggestions, which files to review first, test-coverage gaps, reliability and edge-case concerns, maintainability and duplication, the scope of the change, and the value versus the cost — all from the brief and diff below.',
    `If something is genuinely not in the review brief or the diff, say exactly: "${REFUSAL}" — never invent a file, line, change, risk, or number.`,
    'Speak in short, natural sentences. No markdown, no lists, no code, no symbols — say "fifty-five percent", not "55%".',
    SPOKEN_PATH_RULE,
    'Ask one short question at a time and let the person respond. When they say they are done, thank them and end the call politely.',
  ].join('\n');

  if (!ctx?.prDiff?.files?.length) {
    const why = ctx
      ? 'No code diff is loaded for this pull request. Greet the caller, explain that the live scan has not been run yet, ask them to run a live scan in the extension, and offer to call back.'
      : 'No pull request is loaded. Greet the caller, explain there is no PR context, and ask them to open a pull request and run a live scan first.';
    return `${rules}\n\n=== DIFF ===\n${why}\n=== END ===`;
  }
  // The reviewer-facing brief (verdict, risks, suggestions, tests, scope, value)
  // rides ABOVE the diff — it's what lets the call answer review questions, not
  // just walk changed lines. Omitted when there's nothing to ground it on.
  const brief = serializeReviewBrief(ctx);
  const briefBlock = brief
    ? `\n\n=== REVIEW BRIEF (verdict, risk, tests, suggestions, scope) ===\n${brief}\n=== END ===`
    : '';
  return `${rules}${briefBlock}\n\n=== DIFF (the literal code change) ===\n${serializeDiff(ctx)}\n=== END ===`;
}
