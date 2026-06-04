// PR description — the author's pull-request message body (the GitHub PR
// "conversation" opening comment). Fetched from the PR and carried in the scan
// so the report explains, in the author's own words, WHY the change exists.
//
// Rendered as plain text with the author's line breaks preserved (white-space:
// pre-wrap). React escapes it, so untrusted markdown can't inject HTML. Long
// bodies scroll within the card rather than pushing the whole report down.

import { Section } from '../primitives';

export function DescriptionSection({ body }: { body?: string }) {
  const text = body?.trim();
  if (!text) return null;
  return (
    <Section icon="📋" title="Description">
      <div className="rp-desc">{text}</div>
    </Section>
  );
}
