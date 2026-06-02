// Shared shields.io flat-square badge builder — the single source of truth for
// every centered badge Drift renders, so the header's TL;DR row and the
// no-source notice always look identical (same shape, same escaping rules).
//
// Badges are emitted as raw HTML `<img>` tags (NOT Markdown `![]()`): they are
// wrapped in a block-level `<p align="center">`, and GitHub does NOT parse
// Markdown inside a block-level HTML tag — an `![]()` would render as literal
// text. Dashes/underscores are doubled per shields' path escaping, then the
// whole message is URL-encoded so spaces (`%20`), slashes (`%2F`), `+` (`%2B`)
// and `·` survive; the alt attribute is HTML-escaped.

/** A flat-square shields badge (`message` + `hex` colour) as an HTML `<img>`. */
export function flatBadge(message: string, hex: string): string {
  const enc = encodeURIComponent(message.replace(/-/g, '--').replace(/_/g, '__'));
  const alt = message.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<img alt="${alt}" src="https://img.shields.io/badge/${enc}-${hex}?style=flat-square" />`;
}

/** Wrap one or more badges in a single centered row. */
export function centerBadges(badges: string[]): string {
  return `<p align="center">${badges.join(' ')}</p>`;
}
