// Deterministic, grounded "reasoning" over a detected PR.
//
// There's no model wired yet, so when the extension recognises a PR we still
// want to show that it understood the page — a step-by-step assessment built
// ENTIRELY from the parsed Drift report + scan artifacts (real numbers, no
// invention). This is a pure function so it's unit-testable and so the eventual
// LLM backend can replace it without touching the streaming UI.

import type { PrContext } from '../core/types';

export interface ReasoningStep {
  /** 'step' = a top-level reasoning beat; 'detail' = an indented sub-point. */
  level: 'step' | 'detail';
  text: string;
}

const step = (text: string): ReasoningStep => ({ level: 'step', text });
const detail = (text: string): ReasoningStep => ({ level: 'detail', text });

export function buildReasoning(ctx: PrContext): ReasoningStep[] {
  const { pr, report, artifacts, audio } = ctx;
  const steps: ReasoningStep[] = [];

  steps.push(step(`Recognised a Drift scan on ${pr.repo}#${pr.number}.`));
  if (pr.title) steps.push(detail(`“${pr.title}”`));

  // Verdict + confidence.
  if (report.verdictLabel) {
    const mc = report.mergeConfidence;
    steps.push(
      step(
        `Verdict: ${report.verdictLabel}` +
          (mc ? ` — merge confidence ${mc.value}/${mc.outOf}.` : '.'),
      ),
    );
  }
  if (report.effortLabel) steps.push(detail(`Review effort: ${report.effortLabel}.`));

  // Risk signals.
  const risks = report.gauges.find((g) => g.key === 'risks')?.display;
  if (risks) steps.push(step(`Counting risk signals: ${risks} flagged.`));

  // Critical metrics — the part a reviewer should look at first.
  const critical = report.sections
    .flatMap((s) => s.metrics)
    .filter((m) => m.level === 'critical')
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  if (critical.length) {
    steps.push(step(`${critical.length} critical metric${critical.length > 1 ? 's' : ''} stand out:`));
    for (const m of critical.slice(0, 3)) {
      steps.push(detail(`${m.name}${m.percent !== null ? ` — ${m.percent}%` : ''}.`));
    }
  } else if (report.metricCount) {
    steps.push(step(`Reviewed ${report.metricCount} metrics — none critical.`));
  }

  // Blast radius.
  if (report.blastRadius !== null) {
    const wide = report.blastRadius >= 80;
    steps.push(
      step(
        `Blast radius ${report.blastRadius} — ${wide ? 'wide; changes ripple across the codebase.' : 'fairly contained.'}`,
      ),
    );
  }

  // Test coverage signal.
  const newTests = report.gauges.find((g) => g.key === 'new-tests')?.display;
  if (newTests === '0') {
    steps.push(step('No new tests in this PR — worth confirming coverage on changed lines.'));
  }

  // Artifacts available to deepen the analysis.
  if (artifacts.length) {
    const names = artifacts.map((a) => a.name).join(', ');
    steps.push(step(`Full scan attached: ${names}.`));
    steps.push(detail('Press a file below to download it with your GitHub session.'));
  }

  // Spoken summary.
  if (audio) {
    steps.push(step('A spoken summary is attached — play it below.'));
  }

  // Conclusion.
  const focus = critical[0]?.name;
  steps.push(
    step(
      focus
        ? `Suggested focus: ${focus}. Ask me anything about this PR.`
        : 'Ask me anything about this PR.',
    ),
  );

  return steps;
}

/** Short one-line headline for the reasoning block. */
export function reasoningTitle(ctx: PrContext): string {
  return `Reviewing ${ctx.pr.repo}#${ctx.pr.number}`;
}
