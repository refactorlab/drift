// 📊 Business value — now a single one-liner: a quickchart.io horizontal-bar
// image of per-axis value drift (Δ% vs base), dark theme, regressions red /
// improvements green / flat grey, with the composite + regressed-axis count in
// the title. The old multi-row HTML dashboard, "how each axis was computed"
// details, highlights, and since-last-review line were all removed in favour of
// this chart.

import type { PrCounts, ValueCard, ValueAxis } from '../../report.ts';
import type { DriftState } from '../state.ts';
import { signedPercent } from '../lib/format.ts';

export type ValueCardInput = {
  counts?: PrCounts;
  card?: ValueCard;
  /** overall_drift.percent — the composite. Falls back to the axis mean. */
  overallPercent?: number;
  /** Carried for API compatibility with the overview; unused by the chart. */
  currentState: DriftState;
  priorState?: DriftState | null;
};

export function renderValueCard(input: ValueCardInput): string | null {
  const axes = input.card?.axes ?? [];
  if (axes.length === 0) return null; // no value model → omit the section

  // The H2 is consumed by wrapSection as the collapsible's summary title; the
  // body is just the chart.
  return `## 📊 Business value\n\n${valueDriftChart(axes, input.overallPercent)}`;
}

// ── the one chart ────────────────────────────────────────────────────────────

function valueDriftChart(axes: ValueAxis[], overallPercent?: number): string {
  const labels = axes.map((a) => cleanLabel(a.label));
  const data = axes.map((a) => round1(a.delta_percent));
  const fills = axes.map((a) => barColor(a).fill);
  const borders = axes.map((a) => barColor(a).border);

  const composite = typeof overallPercent === 'number' ? overallPercent : mean(axes.map((a) => a.delta_percent));
  const regressed = axes.filter((a) => a.direction === 'down' || a.delta_percent < 0).length;

  const dataMin = Math.min(0, ...data);
  const dataMax = Math.max(0, ...data);
  const xMin = Math.min(-5, Math.floor(dataMin * 1.15));
  const xMax = Math.max(5, Math.ceil(dataMax * 1.15));

  const config = {
    type: 'horizontalBar',
    data: {
      labels,
      datasets: [
        {
          label: 'Change vs base (%)',
          backgroundColor: fills,
          borderColor: borders,
          borderWidth: 1,
          data,
        },
      ],
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: [
          'PR value drift - per-axis (% vs base)',
          `Composite ${signedPercent(composite)}   |   ${regressed} of ${axes.length} ${axes.length === 1 ? 'axis' : 'axes'} regressed`,
        ],
        fontColor: '#e6e6e6',
        fontSize: 16,
      },
      scales: {
        xAxes: [
          {
            ticks: { min: xMin, max: xMax, fontColor: '#8a8a8a' },
            gridLines: { color: 'rgba(255,255,255,0.08)', zeroLineColor: 'rgba(220,220,220,0.6)', zeroLineWidth: 2 },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: '#cfcfcf', fontSize: 13 },
            gridLines: { color: 'rgba(255,255,255,0.05)' },
          },
        ],
      },
      plugins: {
        datalabels: { color: '#ffffff', anchor: 'end', align: 'end', font: { weight: 'bold', size: 13 } },
      },
    },
  };
  const url = `https://quickchart.io/chart?bkg=%230d0d10&w=900&h=400&c=${encodeURIComponent(JSON.stringify(config))}`;
  return `![PR value drift](${url})`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Drop a leading emoji/symbol so the chart label reads as plain text. */
function cleanLabel(label: string): string {
  return label.replace(/^[^\p{L}]+/u, '').trim() || label;
}

/** Regression → red, improvement → green, flat → grey (matches the gauge palette). */
function barColor(a: ValueAxis): { fill: string; border: string } {
  if (a.direction === 'down' || a.delta_percent < 0) return { fill: 'rgba(226,75,74,0.85)', border: 'rgb(226,75,74)' };
  if (a.direction === 'up' || a.delta_percent > 0) return { fill: 'rgba(63,185,80,0.85)', border: 'rgb(63,185,80)' };
  return { fill: 'rgba(136,135,128,0.7)', border: 'rgb(136,135,128)' };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mean(ns: number[]): number {
  return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0;
}
