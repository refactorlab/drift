import { Highlight, themes, type Language } from "prism-react-renderer";

interface Props {
  code: string;
  language: Language;
  startLine: number;
  /** "remove" → red tint, "add" → green tint, "none" → plain */
  variant?: "remove" | "add" | "none";
}

/**
 * Line-numbered, syntax-highlighted code block. One <div className="code-line">
 * per source line, so we can paint per-line backgrounds for the red/green
 * before/after variants without touching Prism's tokenization.
 */
export function CodeLines({ code, language, startLine, variant = "none" }: Props) {
  // Trailing newline produces an empty trailing token line — drop it so we
  // don't render a phantom blank row at the bottom of every block.
  const body = code.replace(/\n$/, "");

  return (
    <Highlight code={body} language={language} theme={themes.github}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`code-lines code-lines--${variant} ${className}`}
          style={{ ...style, margin: 0 }}
        >
          {tokens.map((line, i) => {
            const { key: _lk, ...lineProps } = getLineProps({ line });
            return (
              <div
                key={i}
                {...lineProps}
                className={`code-line code-line--${variant}`}
              >
                <span className="code-line__num">{startLine + i}</span>
                <span className="code-line__text">
                  {line.map((token, j) => {
                    const { key: _tk, ...tokenProps } = getTokenProps({ token });
                    return <span key={j} {...tokenProps} />;
                  })}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
