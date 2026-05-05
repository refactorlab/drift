import type { ReactNode } from 'react';

const KEYWORDS = new Set([
  'const', 'let', 'var', 'await', 'async', 'function', 'return',
  'for', 'of', 'in', 'if', 'else', 'while', 'try', 'catch',
  'throw', 'new', 'class', 'extends', 'import', 'export', 'from',
  'true', 'false', 'null', 'undefined',
]);

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const commentIdx = line.indexOf('//');
  const code = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';

  const tokenRegex =
    /(`[^`]*`)|('[^']*')|("[^"]*")|(\b\d+\b)|([A-Za-z_$][\w$]*)|([^A-Za-z_$\d`'"]+)/g;

  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = tokenRegex.exec(code)) !== null) {
    const [tok, tplStr, sgl, dbl, num, ident, other] = m;
    if (tplStr !== undefined || sgl !== undefined || dbl !== undefined) {
      out.push(<span key={key++} className="tok-str">{tok}</span>);
    } else if (num !== undefined) {
      out.push(<span key={key++} className="tok-num">{tok}</span>);
    } else if (ident !== undefined) {
      if (KEYWORDS.has(ident)) {
        out.push(<span key={key++} className="tok-key">{ident}</span>);
      } else {
        const after = code.slice(tokenRegex.lastIndex);
        const isCall = /^\s*\(/.test(after);
        if (isCall) out.push(<span key={key++} className="tok-fn">{ident}</span>);
        else out.push(<span key={key++}>{ident}</span>);
      }
    } else {
      out.push(<span key={key++}>{other}</span>);
    }
  }
  if (comment) out.push(<span key={key++} className="tok-comment">{comment}</span>);
  return out;
}

export function CodeBlock({
  title,
  lang,
  startLine,
  code,
  variant = 'plain',
  rightLabel,
}: {
  title: string;
  lang?: string | null;
  startLine: number;
  code: string;
  variant?: 'good' | 'bad' | 'plain';
  rightLabel?: string;
}) {
  const lines = code.split('\n');
  return (
    <div className="code-block">
      <div className="code-header">
        <span>{title}</span>
        <span>{rightLabel ?? lang ?? ''}</span>
      </div>
      {lines.map((src, i) => (
        <div
          key={i}
          className={`code-line${variant === 'good' ? ' good' : variant === 'bad' ? ' bad' : ''}`}
        >
          <span className="ln">{startLine + i}</span>
          <span className="src">{highlight(src)}</span>
        </div>
      ))}
    </div>
  );
}
