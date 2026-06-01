// A JSON document glyph used on file cards/chips.
export function FileIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 2.75h7l4.25 4.25V20.5a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75v-17A.75.75 0 0 1 6 2.75Z"
        fill="var(--drift-bg)"
        stroke="var(--drift-accent)"
        strokeWidth="1.3"
      />
      <path d="M13 2.75V7.25h4.25" fill="none" stroke="var(--drift-accent)" strokeWidth="1.3" />
      <text
        x="11.5"
        y="17.5"
        textAnchor="middle"
        fontSize="6.5"
        fontFamily="ui-monospace, monospace"
        fontWeight="700"
        fill="var(--drift-accent)"
      >
        {'{ }'}
      </text>
    </svg>
  );
}
