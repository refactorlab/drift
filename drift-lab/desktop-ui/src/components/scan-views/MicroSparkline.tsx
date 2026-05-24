// Zero-dep SVG sparkline. Renders one polyline + an optional area
// fill across the supplied values. Pure presentation — domain math
// (where to slice from, what the latest value means, etc.) lives in
// the caller, this component just paints what it's given.
//
// Design notes:
//   - SVG, not canvas: at ≤120 points per card the rendering cost is
//     trivial and SVG composes cleanly with the rest of the React
//     tree (no resize observer / DPI dance).
//   - `viewBox` is fixed and the wrapper element stretches with CSS;
//     callers get a responsive width without per-resize re-renders.
//   - Empty / all-zero / single-point inputs render an axis-line stub
//     instead of throwing — the live overview should never produce a
//     broken card while waiting for the second sample to arrive.

interface Props {
  /** Numeric series, oldest → newest. */
  values: readonly number[];
  /** Drawing height in viewBox units (default 32). The wrapper's CSS
   *  height determines the actual on-screen pixels; this only sets the
   *  internal aspect ratio. */
  height?: number;
  /** Stroke color. Defaults to `currentColor` so the parent's text
   *  color drives the line — keeps the component themeable without
   *  prop-drilling tokens. */
  stroke?: string;
  /** Optional fill color for the area under the line. Pass
   *  `"transparent"` (or omit) to skip the fill. */
  fill?: string;
  /** Stroke width in viewBox units. */
  strokeWidth?: number;
  /** ARIA label. Default works for memory; CPU sparkline overrides. */
  ariaLabel?: string;
}

const VIEW_WIDTH = 100; // arbitrary; matches CSS width via stretch

export default function MicroSparkline({
  values,
  height = 32,
  stroke = "currentColor",
  fill,
  strokeWidth = 1.25,
  ariaLabel = "sparkline",
}: Props): JSX.Element {
  if (values.length === 0) {
    return (
      <svg
        className="micro-sparkline"
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${ariaLabel}: no data`}
      >
        <line
          x1={0}
          x2={VIEW_WIDTH}
          y1={height / 2}
          y2={height / 2}
          stroke={stroke}
          strokeWidth={0.5}
          opacity={0.25}
        />
      </svg>
    );
  }

  // Normalize to [0, 1]; flatlines render at the vertical midpoint.
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  const norm = (v: number) => (span === 0 ? 0.5 : (v - min) / span);

  // Map normalised value 0..1 to SVG y (inverted — y=0 is top).
  // Padding 1 unit keeps the stroke from clipping at the edges.
  const pad = 1;
  const yOf = (v: number) => height - pad - norm(v) * (height - 2 * pad);
  const xStep = values.length === 1 ? 0 : VIEW_WIDTH / (values.length - 1);

  let polyline = "";
  let area = `M 0 ${height} `;
  values.forEach((v, i) => {
    const x = i * xStep;
    const y = yOf(v);
    polyline += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
    area += `${i === 0 ? "L" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
  });
  area += `L ${VIEW_WIDTH} ${height} Z`;

  return (
    <svg
      className="micro-sparkline"
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${ariaLabel}: ${values.length} samples`}
    >
      {fill && fill !== "transparent" && (
        <path d={area} fill={fill} stroke="none" opacity={0.35} />
      )}
      <path
        d={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
