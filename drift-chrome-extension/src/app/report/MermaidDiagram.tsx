// Renders ONE Mermaid source string (a scanner-generated architecture/business
// diagram) into SVG, via the shared core/mermaid helper. Isolates failures to
// this card: a bad diagram falls back to its source text instead of throwing.

import { useEffect, useRef, useState } from 'react';
import { renderMermaid, effectiveMermaidTheme } from '../../core/mermaid';

export function MermaidDiagram({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const code = source.trim();
    if (!code) return;
    renderMermaid(code, effectiveMermaidTheme())
      .then((svg) => {
        if (live && ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [source]);

  if (failed) return <pre className="rp-mermaid-fallback">{source.trim()}</pre>;
  return <div className="rp-mermaid" ref={ref} />;
}
