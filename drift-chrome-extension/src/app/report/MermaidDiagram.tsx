// Renders ONE Mermaid source string (a scanner-generated architecture/business
// diagram) into SVG, via the shared core/mermaid helper. Isolates failures to
// this card: a bad diagram falls back to its source text instead of throwing.

import { useEffect, useRef, useState } from 'react';
import { renderMermaid, effectiveMermaidTheme } from '../../core/mermaid';
import { PanZoom } from './PanZoom';

export function MermaidDiagram({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const code = source.trim();
    if (!code) return;
    renderMermaid(code, effectiveMermaidTheme())
      .then((svg) => {
        if (!live || !ref.current) return;
        ref.current.innerHTML = svg;
        const el = ref.current.querySelector('svg') as SVGSVGElement | null;
        if (el) {
          // Mermaid hard-codes the svg's `width`/`max-width`; strip them so it
          // fills the viewport width responsively (height follows the viewBox).
          el.removeAttribute('width');
          el.removeAttribute('height');
          el.style.maxWidth = 'none';
          el.style.width = '100%';
          el.style.height = 'auto';
          // Crop the viewBox to the diagram's TRUE bounds. Mermaid pads the
          // viewBox with margin, so at width:100% the content floats in the
          // middle with dead space on the sides — the "gaps" complaint. A tight
          // getBBox (+ a hair of padding) makes the graph fill edge-to-edge.
          try {
            const inner = el.querySelector('g') as SVGGraphicsElement | null;
            const box = inner?.getBBox();
            if (box && box.width > 0 && box.height > 0) {
              const p = 6;
              el.setAttribute(
                'viewBox',
                `${box.x - p} ${box.y - p} ${box.width + p * 2} ${box.height + p * 2}`,
              );
              el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
          } catch {
            /* getBBox throws if the svg isn't laid out yet — keep mermaid's viewBox. */
          }
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [source]);

  if (failed) return <pre className="rp-mermaid-fallback">{source.trim()}</pre>;
  return (
    <PanZoom>
      <div className="rp-mermaid" ref={ref} />
    </PanZoom>
  );
}
