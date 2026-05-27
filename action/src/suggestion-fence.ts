// GitHub committable-suggestion fence helper.
//
// A ```suggestion block is what renders the "Apply suggestion" button, but
// GitHub ends the block at the FIRST run of backticks whose length is >= the
// opening fence. So a hardcoded 3-backtick fence silently breaks the moment
// the replacement code itself contains ``` (a docstring code example, a TS
// template literal, embedded markdown). The fix — per GitHub community
// discussion #76840 and CommonMark fence nesting — is to size the fence to
// (longest inner backtick run + 1), with a floor of 3. GitHub recognises
// suggestion fences of 4+ backticks (````suggestion).

/**
 * Wrap replacement code in a correctly-sized ```suggestion block. The fence
 * is always longer than the longest backtick run inside `code`, so inner
 * backticks can never terminate the block early.
 */
export function suggestionBlock(code: string): string {
  const runs = code.match(/`+/g) ?? [];
  const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}suggestion\n${code}\n${fence}`;
}

/**
 * Strip a single fenced block the MODEL may have wrapped around the
 * replacement code despite being told not to (e.g. "```ts\n…\n```"). Left
 * in place it would be committed as literal backtick lines. Safe for this
 * action because the scanner only targets code files (py/ts/go/rs/…), never
 * markdown, so a legitimately fence-shaped `after_code` does not occur.
 * Conservative: only unwraps when the WHOLE string is one fenced block.
 */
export function unwrapFence(raw: string): string {
  const s = raw.replace(/\r\n/g, '\n');
  const m = s.match(/^\s*`{3,}[^\n]*\n([\s\S]*?)\n`{3,}\s*$/);
  return m ? m[1] : raw;
}
