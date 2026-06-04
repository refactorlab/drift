// Compile a single scanner-generated Mermaid diagram into SVG. The native scan
// report (no markdown) renders each architecture/risk diagram through here via
// the MermaidDiagram component. Eager import — diagrams are core to the report —
// but `initialize` runs once and re-runs only when the UI theme flips.

import mermaid from 'mermaid';

export type MermaidTheme = 'dark' | 'light';

let initializedFor: MermaidTheme | null = null;
let counter = 0;

/** The UI's effective light/dark theme, resolving "system". */
export function effectiveMermaidTheme(): MermaidTheme {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return 'dark';
  if (t === 'light') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ensureInitialized(theme: MermaidTheme): void {
  if (initializedFor === theme) return;
  mermaid.initialize({
    startOnLoad: false,
    // Per-diagram `%%{init}%%` / frontmatter directives the scanner emits still
    // win; this is just the baseline for diagrams without a baked theme.
    theme: theme === 'dark' ? 'dark' : 'default',
    // Diagram text is scanner-generated and already hardened for the parser, but
    // treat it as untrusted for XSS: strict sanitizes any HTML in labels.
    securityLevel: 'strict',
    fontFamily: 'inherit',
    suppressErrorRendering: true,
    // Render node labels as native SVG <text>, NOT foreignObject HTML. SVG text
    // stays crisp at any pan/zoom scale (foreignObject rasterises and blurs), and
    // it gives the viewport a reliable getBBox to fit against.
    htmlLabels: false,
    flowchart: {
      htmlLabels: false,
      // Tighten the layout: scanner call-graphs are sparse DAGs, and Mermaid's
      // default 50px node/rank spacing leaves big dead gaps. Pack them closer and
      // trim the outer diagram padding so the graph reads dense, not scattered.
      nodeSpacing: 26,
      rankSpacing: 44,
      padding: 6,
      diagramPadding: 4,
      curve: 'basis',
    },
  });
  initializedFor = theme;
}

/** Render one Mermaid source string to an SVG string (throws on parse error). */
export async function renderMermaid(source: string, theme: MermaidTheme): Promise<string> {
  ensureInitialized(theme);
  const id = `drift-mmd-${counter++}`;
  const { svg } = await mermaid.render(id, source.trim());
  return svg;
}
