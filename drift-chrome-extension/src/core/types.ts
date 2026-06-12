// Domain model for a parsed Drift / Andy PR report.
//
// The Andy GitHub Action posts ONE sticky comment whose data is encoded in
// deterministic badge + gauge `alt` text (GitHub strips HTML comments, so we
// can't rely on a hidden JSON marker being in the DOM). `parse.ts` reads that
// alt text into the shapes below. Keeping this as a standalone module means a
// future machine-readable payload can populate the same types without the UI
// changing.

import type { PrDiff, ReviewBrief } from './scanOutput';

export type Verdict = 'address' | 'review' | 'approve' | 'unknown';

export type MetricLevel = 'low' | 'moderate' | 'critical' | 'unknown';

/** "Higher is better" vs "lower is better" — derived from the trend arrow. */
export type Direction = 'up' | 'down' | 'none';

/** One of the six headline gauges at the top of the comment. */
export interface Gauge {
  key: string; // stable id, e.g. "merge-confidence"
  label: string; // "MERGE CONFIDENCE"
  /** Raw display value as shown, e.g. "0/5", "7", "−5.5%", "383". */
  display: string;
  /** Normalized 0..1 fill for the dial, when one can be inferred. */
  fraction: number | null;
  tone: 'good' | 'warn' | 'bad' | 'info';
}

/** A single row inside the Complexity & Risk Report. */
export interface Metric {
  name: string; // "Token footprint"
  level: MetricLevel; // from the LOW/MODERATE/CRITICAL badge label
  percent: number | null; // 0..100
  direction: Direction; // ↑ / ↓
}

export interface MetricSection {
  index: number; // 1..6
  title: string; // "LLM Complexity"
  metrics: Metric[];
}

export interface DriftReport {
  /** Whether a Drift comment was actually located on the page. */
  found: boolean;
  verdict: Verdict;
  verdictLabel: string; // "Address before merge"
  /** e.g. "High risk · 60 min+ review" */
  effortLabel: string | null;
  mergeConfidence: { value: number; outOf: number } | null;
  gauges: Gauge[];
  /** "Blast radius 100 · 4 critical · 18 metrics" → parsed pieces. */
  blastRadius: number | null;
  criticalCount: number | null;
  metricCount: number | null;
  sections: MetricSection[];
  /** Canonical PR url the report was read from, when known. */
  prUrl: string | null;
  scrapedAt: number; // epoch ms
}

/** A machine-readable context file. */
export interface ArtifactRef {
  /** Consumer-facing filename, e.g. "pr-scan.json". */
  name: string;
  /**
   * GitHub Actions artifact URL (zipped; 404s for logged-out viewers). Absent
   * when the comment didn't link an upload — the file is then reconstructed
   * locally from the parsed report.
   */
  url?: string;
  kind: 'scan-report' | 'scan-context' | 'other';
}

/**
 * The spoken-summary audio the action attaches to the comment (a GitHub Actions
 * artifact, zipped, containing one audio file — Kokoro TTS output). Kept separate
 * from `artifacts` because it's played, not downloaded as a JSON file.
 */
export interface AudioRef {
  /** GitHub Actions artifact URL (zip; download-gated by GitHub auth). */
  url: string;
  /** The link's accessible label, e.g. "🔊 Listen to the spoken summary (Kokoro TTS)". */
  label: string;
}

/** Identity of the pull request the side panel is looking at. */
export interface PrIdentity {
  owner: string;
  repo: string;
  number: number;
  title: string | null;
  url: string;
}

/**
 * Everything the chat can use as grounding for a PR: the parsed Drift report
 * (always available from the rendered comment) plus links to the full,
 * uncapped scan artifacts (download-gated by GitHub auth).
 */
export interface PrContext {
  pr: PrIdentity;
  report: DriftReport;
  artifacts: ArtifactRef[];
  /**
   * The literal +/- code change (the scan-pr JSON's `pr_diff`), present only on
   * a live-scan context — it's what the voice agent grounds on per scan. Absent
   * for a scraped-comment context (a Drift comment carries no diff).
   */
  prDiff?: PrDiff;
  /**
   * Reviewer-facing distillation of the scan (risk, suggestions, tests, scope,
   * value) — present only on a live-scan context. The Dial phone agent grounds on
   * this ALONGSIDE the diff so it can answer the questions a reviewer actually
   * asks, not just walk the changed lines.
   */
  reviewBrief?: ReviewBrief;
  /** Spoken-summary audio, when the comment linked one. */
  audio?: AudioRef;
  detectedAt: number;
}

export function emptyReport(): DriftReport {
  return {
    found: false,
    verdict: 'unknown',
    verdictLabel: '',
    effortLabel: null,
    mergeConfidence: null,
    gauges: [],
    blastRadius: null,
    criticalCount: null,
    metricCount: null,
    sections: [],
    prUrl: null,
    scrapedAt: 0,
  };
}
