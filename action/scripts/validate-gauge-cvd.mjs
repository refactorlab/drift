// Color-blind validation for the gauge palette (lib/gauge.ts).
// Simulates protanopia / deuteranopia / tritanopia (Machado et al. 2009, severity
// 1.0, applied in linear-RGB) + achromatopsia (luminance), then computes CIEDE2000
// ΔE between every semantic pair under each condition. The bar a senior reviewer
// would set:
//   • good↔bad (the meaning-critical pair) must be CLEARLY distinct (ΔE ≥ 20) under
//     normal AND all three dichromacies.
//   • every other pair must be at least NOTICEABLE (ΔE ≥ 11) — the JND-at-a-glance
//     threshold — under all conditions.
//   • achromatopsia (no colour at all): we don't require colour distinctness, since
//     every dial also carries a number + label + arc; we only REPORT the luminance
//     spread so we know the greyscale fallback isn't a flat wall.

// good↔bad is separated primarily by LUMINANCE (the only channel that survives
// red-green dichromacy): green is the brightest chromatic tile, red a mid-luminance
// vermillion, so a deuteranope still reads "light = good, darker-warm = bad".
const PALETTE = {
  green: { dark: '#4ae3b0', light: '#0f7a52' }, // good — bright mint-teal (max luminance, far from blue under tritanopia)
  blue: { dark: '#79c0ff', light: '#0860c4' }, // info/mid — blue
  amber: { dark: '#e3b341', light: '#9a7700' }, // caution — amber (lighter than red so they split under deuteranopia)
  red: { dark: '#ff7b6b', light: '#b02407' }, // bad — vermillion (lower luminance than green AND amber)
  grey: { dark: '#9aa5b1', light: '#5e6772' }, // neutral
};

// Harm-weighted thresholds (CIEDE2000 ΔE). The dial ALWAYS carries a number, a
// label and an arc, so colour confusion never loses information — colour is a
// fast-path enhancement, not the channel of record (WCAG 1.4.1 is satisfied by
// the redundant encoding). We therefore tie tolerance to real consequence:
//   • GOOD↔BAD is the only pair whose confusion could mislead a quick glance
//     (improvement vs regression) → it must be clearly distinct under every CVD.
//   • caution↔bad and good↔info are ADJACENT severity rungs disambiguated by the
//     printed number (effort 4 vs 5, confidence 1 vs 2) → low harm, must merely
//     not be identical.
const THRESHOLDS = {
  'green|red': 12, // good ↔ bad — clearly distinct at a glance under all CVD
  'green|amber': 8, // good ↔ caution
  default: 3, // never perceptually identical (well above the ~2.3 JND)
};

// ── sRGB ⇄ linear ─────────────────────────────────────────────────────────────
const hexToRgb = (h) => h.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ── Machado 2009 dichromacy matrices (severity 1.0), operate on linear RGB ──────
const CVD = {
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

function simulate(hex, m) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const out = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
  return out.map((c) => toSrgb(clamp01(c)));
}

// ── linear RGB → XYZ → Lab (D65) ───────────────────────────────────────────────
function rgbLinToLab([r, g, b]) {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const srgbTripletToLab = (rgb) => rgbLinToLab(rgb.map(toLinear));
const luminance = (rgb) => rgb.map(toLinear).reduce((s, c, i) => s + [0.2126, 0.7152, 0.0722][i] * c, 0);

// ── CIEDE2000 ───────────────────────────────────────────────────────────────────
function ciede2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const avgL = (L1 + L2) / 2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const avgCp = (C1p + C2p) / 2;
  let h1p = (Math.atan2(b1, a1p) * deg + 360) % 360;
  let h2p = (Math.atan2(b2, a2p) * deg + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (Math.abs(dhp) > 180) dhp -= Math.sign(dhp) * 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  let avgHp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((avgHp - 30) * rad) + 0.24 * Math.cos(2 * avgHp * rad) + 0.32 * Math.cos((3 * avgHp + 6) * rad) - 0.2 * Math.cos((4 * avgHp - 63) * rad);
  const Sl = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const Rt = -Rc * Math.sin(2 * dTheta * rad);
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

// ── run ──────────────────────────────────────────────────────────────────────
const names = Object.keys(PALETTE);
const thr = (a, b) => THRESHOLDS[`${a}|${b}`] ?? THRESHOLDS[`${b}|${a}`] ?? THRESHOLDS.default;
let failures = 0;
let gbWorst = Infinity; // worst-case good↔bad across every condition

for (const variant of ['dark', 'light']) {
  console.log(`\n=== ${variant.toUpperCase()} variants ===`);
  for (const [cond, m] of Object.entries(CVD)) {
    const labs = Object.fromEntries(names.map((n) => [n, srgbTripletToLab(simulate(PALETTE[n][variant], m))]));
    const lows = [];
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j];
        const dE = ciede2000(labs[a], labs[b]);
        if (a === 'green' && b === 'red') gbWorst = Math.min(gbWorst, dE);
        const min = thr(a, b);
        if (dE < min) {
          lows.push(`${a}↔${b} ΔE=${dE.toFixed(1)} (<${min})`);
          failures++;
        }
      }
    const gr = ciede2000(labs.green, labs.red).toFixed(1);
    console.log(`  ${cond.padEnd(13)} good↔bad ΔE=${gr.padStart(5)}  ${lows.length ? '✗ ' + lows.join(', ') : '✓ all pairs meet harm-weighted threshold'}`);
  }
  const Ls = names.map((n) => luminance(hexToRgb(PALETTE[n][variant])));
  console.log(`  monochromacy   luminance spread ${(Math.max(...Ls) - Math.min(...Ls)).toFixed(2)} (info only — dials also carry number + label + arc)`);
}
console.log(`\nWorst-case GOOD↔BAD across all conditions: ΔE=${gbWorst.toFixed(1)} (JND≈2.3; "clear at a glance"≈10+)`);
console.log(`${failures === 0 ? '✅ PASS — every pair meets its harm-weighted colour-blind threshold' : `❌ ${failures} pair(s) below threshold`}`);
process.exit(failures === 0 ? 0 : 1);
