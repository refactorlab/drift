// QuickChart radialGauge KPI tiles — the at-a-glance metric dashboard that opens
// the sticky comment. GitHub strips inline <svg>/JS from comments, so a hosted
// PNG is the only way to land a real gauge; each tile is a `<picture>` with a
// dark-scheme `<source>` + a light-scheme `<img>` fallback so it reads in both
// comment themes. The centred number is the SIGNAL; the arc is proportional for
// the two 0–5 gauges and full (decorative) for count/percent tiles.
//
// ── Accessible palette (Okabe-Ito, blue↔orange severity axis) ────────────────
// Built for colour-vision deficiency (≈8% of men, ≈0.5% of women). The single
// biggest win: the good→bad scale runs along the BLUE↔ORANGE axis, NOT red↔green
// — red/green is the confusion pair for protanopia & deuteranopia (≈99% of CVD),
// so any red-vs-green dashboard reads as one colour to those users. Blue, teal,
// orange and vermillion stay mutually distinct under protan-, deuteran- AND
// tritanopia, and they're separated by LIGHTNESS as well as hue, so the dials
// also survive full greyscale / low-vision. Hues are taken from the Okabe-Ito
// colour-blind-safe palette (the data-viz accessibility standard).
//
// Colour is never the sole signal regardless: every tile carries a number, a
// label, and an arc — meaning survives even if the colour is dropped entirely.
//
// Each semantic colour ships a dark/light pair so it clears WCAG-AA contrast on
// both GitHub themes (the centred value is large, ≥26px bold → the 3:1 large-text
// bar). `dark` is the brighter member (renders on the ~#0d1117 dark canvas),
// `light` the deeper one (on white).
// The good→bad pair is separated primarily by LUMINANCE — the only channel that
// survives red-green dichromacy (≈99% of CVD), where hue collapses. `green` is the
// BRIGHTEST chromatic tile and `red` a mid-luminance vermillion, so a deuteranope
// still reads "bright = good, darker-warm = bad". Validated by scripts/
// validate-gauge-cvd.mjs, which simulates protan-/deuteran-/tritanopia (Machado
// 2009) and requires CIEDE2000 ΔE ≥ 12 for good↔bad under EVERY condition (it lands
// ≥15 worst-case). `npm run validate-cvd` re-checks any future edit.
//   green = good      → bright mint-teal (max luminance)
//   blue  = info/mid  → blue
//   amber = caution   → amber (kept lighter than red so they split under CVD)
//   red   = bad       → vermillion (lower luminance than both green and amber)
//   grey  = neutral   → muted slate

export type GaugeColor = 'green' | 'amber' | 'red' | 'blue' | 'grey';

type Pair = { dark: string; light: string };

const ARC: Record<GaugeColor, Pair> = {
  green: { dark: '#4ae3b0', light: '#0f7a52' },
  blue: { dark: '#79c0ff', light: '#0860c4' },
  amber: { dark: '#e3b341', light: '#9a7700' },
  red: { dark: '#ff7b6b', light: '#b02407' },
  grey: { dark: '#9aa5b1', light: '#5e6772' },
};
const TRACK: Pair = { dark: '#2d333b', light: '#e7ecf0' };
const TITLE: Pair = { dark: '#9aa5b1', light: '#5e6772' };

export type Gauge = {
  /** ALL-CAPS tile heading, e.g. `MERGE CONFIDENCE`. */
  title: string;
  /** The centred value text, e.g. `1/5`, `9`, `−10.5%`. */
  center: string;
  /** Arc fill 0–100; clamped. Use 100 for count/percent tiles (the number is the signal). */
  arc: number;
  color: GaugeColor;
};

/** Centre font size scaled to the value's width so long values still fit the dial. */
function centerFont(text: string): number {
  if (text.includes('%')) return 26; // "−10.5%"
  if (text.includes('/')) return 40; // "1/5"
  if (text.length <= 1) return 46; // "9"
  if (text.length === 2) return 44; // "53"
  return 32; // "680"
}

function chartUrl(g: Gauge, arc: string, track: string, title: string): string {
  const config = {
    type: 'radialGauge',
    data: { datasets: [{ data: [Math.max(0, Math.min(100, g.arc))], backgroundColor: arc }] },
    options: {
      domain: [0, 100],
      trackColor: track,
      roundedCorners: true,
      centerPercentage: 82,
      centerArea: { text: g.center, fontColor: arc, fontSize: centerFont(g.center) },
      title: { display: true, text: g.title, fontColor: title, fontSize: 13, fontStyle: 'bold' },
    },
  };
  return `https://quickchart.io/chart?w=260&h=240&bkg=transparent&c=${encodeURIComponent(JSON.stringify(config))}`;
}

/** A single responsive gauge tile (dark `<source>` + light `<img>` fallback). */
export function gaugeCell(g: Gauge): string {
  const c = ARC[g.color];
  const dark = chartUrl(g, c.dark, TRACK.dark, TITLE.dark);
  const light = chartUrl(g, c.light, TRACK.light, TITLE.light);
  const alt = `${g.title} ${g.center}`;
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${dark}"><img width="150" alt="${alt}" src="${light}" /></picture>`;
}

/**
 * Lay the tiles out in an HTML table, `cols` per row. The last row is padded
 * with empty cells so a multi-row table stays rectangular; a single short row is
 * sized to its content (no trailing empty column).
 */
export function gaugeTable(gauges: Gauge[], cols = 4): string {
  if (gauges.length === 0) return '';
  const width = Math.min(cols, gauges.length);
  const rows: string[] = [];
  for (let i = 0; i < gauges.length; i += cols) {
    const cells = gauges.slice(i, i + cols).map((g) => `<td align="center">${gaugeCell(g)}</td>`);
    while (cells.length < width) cells.push('<td></td>');
    rows.push(`<tr>\n${cells.join('\n')}\n</tr>`);
  }
  return `<table>\n${rows.join('\n')}\n</table>`;
}
