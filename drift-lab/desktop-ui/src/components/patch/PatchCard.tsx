import type { Language } from "prism-react-renderer";
import type { PatchSections } from "../../lib/patch";
import { CodeLines } from "./CodeLines";

interface Props {
  title: string;
  severity?: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  /** e.g. "+387ms" */
  impactBadge?: string;
  /** e.g. "P95 impact" */
  impactSubtitle?: string;
  /** e.g. "184 queries × ~2.1ms each · Database overuse" */
  metaLine?: string;
  language: Language;

  sections: PatchSections;
  streaming: boolean;
  onApply: () => void;
  applyDisabled?: boolean;
}

export function PatchCard({
  title,
  severity = "critical",
  file,
  line,
  impactBadge,
  impactSubtitle,
  metaLine,
  language,
  sections,
  streaming,
  onApply,
  applyDisabled,
}: Props) {
  const startLine = sections.originalStartLine ?? line;
  const removedCount = sections.original ? sections.original.split("\n").filter(Boolean).length : 0;
  const addedCount = sections.replacement ? sections.replacement.split("\n").filter(Boolean).length : 0;

  return (
    <article className="patch-card">
      <header className="patch-card__head">
        <div className="patch-card__title">
          <span className={`dot dot--${severity}`} />
          <h2>{title}</h2>
          <span className={`badge badge--${severity}`}>{severity.toUpperCase()}</span>
        </div>
        <div className="patch-card__meta">
          <code>{file}:{line}</code>
          {metaLine && <span className="muted"> · {metaLine}</span>}
        </div>
        {impactBadge && (
          <div className="patch-card__impact">
            <div className="patch-card__impact-value">{impactBadge}</div>
            {impactSubtitle && <div className="muted">{impactSubtitle}</div>}
          </div>
        )}
      </header>

      <section className="patch-card__section">
        <h3>PROBLEM</h3>
        <p className="patch-card__problem">
          {sections.problem || (streaming ? <Skeleton /> : "—")}
        </p>
      </section>

      <section className="patch-card__section">
        <div className="patch-card__section-head">
          <h3>CODE</h3>
          <span className="muted patch-card__lang">{languageLabel(language)}</span>
        </div>
        {sections.original ? (
          <CodeLines
            code={sections.original}
            language={language}
            startLine={startLine}
            variant="remove"
          />
        ) : (
          streaming && <Skeleton block />
        )}
      </section>

      <section className="patch-card__section">
        <div className="patch-card__section-head">
          <h3>SUGGESTED FIX</h3>
          <span className="muted">{sections.fixLabel || (streaming ? "…" : "")}</span>
          {(removedCount > 0 || addedCount > 0) && (
            <span className="muted patch-card__diffstat">
              -{removedCount} +{addedCount}
            </span>
          )}
        </div>
        {sections.replacement ? (
          <CodeLines
            code={sections.replacement}
            language={language}
            startLine={startLine}
            variant="add"
          />
        ) : (
          streaming && <Skeleton block />
        )}
      </section>

      {sections.impact && (
        <footer className="patch-card__footer">
          <span className="patch-card__bolt" aria-hidden>⚡</span>
          <div>
            <strong>Estimated improvement: </strong>
            <span>{sections.impact}</span>
          </div>
        </footer>
      )}

      <div className="patch-card__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={applyDisabled || streaming || !sections.complete}
          onClick={onApply}
        >
          Apply
        </button>
      </div>
    </article>
  );
}

function languageLabel(lang: Language): string {
  switch (lang) {
    case "tsx":
    case "typescript":
      return "TypeScript";
    case "jsx":
    case "javascript":
      return "JavaScript";
    case "rust":
      return "Rust";
    case "python":
      return "Python";
    case "go":
      return "Go";
    default:
      return String(lang);
  }
}

function Skeleton({ block = false }: { block?: boolean }) {
  return <span className={block ? "skeleton skeleton--block" : "skeleton"} />;
}
