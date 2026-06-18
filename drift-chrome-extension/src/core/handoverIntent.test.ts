import { describe, expect, it } from 'vitest';
import { parseHandoverIntent } from './handoverIntent';

const STEPS = [{ path: 'src/core/auth.ts' }, { path: 'src/app/Chat.tsx' }, { path: 'package.json' }];
const kind = (t: string, steps?: { path: string }[]) => parseHandoverIntent(t, steps)?.kind ?? null;

describe('parseHandoverIntent', () => {
  it('detects START requests', () => {
    for (const t of [
      'walk me through this PR',
      'give me a handover',
      'start a guided walkthrough',
      'PR handover mode',
      "Let's go to PR_Handover mode.", // underscore separator (the "resumed instead of restarted" bug)
      'pr-handover mode',
      'review the PR file by file',
      "let's go through the changes step by step",
    ])
      expect(kind(t)).toBe('start');
  });

  it('detects NEXT incl. affirmatives', () => {
    for (const t of ['next', 'next file', 'proceed', 'continue', 'go on', 'keep going', 'go ahead', 'yes', 'ok', 'sure!', 'lgtm'])
      expect(kind(t)).toBe('next');
  });

  it('detects NEXT through leading filler + natural "go to the next" phrasings (the repeat bug)', () => {
    for (const t of [
      'So go to the next file that is important in this PR.', // exact phrase from the bug report
      'Yeah, continue to continue to the next one. I know this file.', // exact phrase from the bug report
      'okay, next',
      'so proceed',
      'go to the next file',
      'move on to the next',
      'skip to the next file',
      'continue to the next one',
      "let's see the next file",
      'and go to the next',
    ])
      expect(kind(t)).toBe('next');
  });

  it('treats "start/open the first/next file" as NEXT — open it, not re-list the plan (the "didn\'t navigate" bug)', () => {
    for (const t of [
      'start from the first file.', // exact phrase from the bug report
      'Yeah, start next.', // exact phrase from the bug report
      'start the first file',
      'open the first file',
      'start with the next file',
      'open the next one',
      "let's start with the first file",
    ])
      expect(kind(t)).toBe('next');
    // …but a generic "start a walkthrough" (no first/next) still STARTS (re-shows the plan).
    expect(kind('start a guided walkthrough')).toBe('start');
  });

  it('does NOT treat a question containing "next" as advance', () => {
    expect(kind('what does the next() function do?')).toBeNull();
    expect(kind("what's next")).toBe('status'); // informational stays status
  });

  it('detects PREV', () => {
    for (const t of ['back', 'go back', 'previous file']) expect(kind(t)).toBe('prev');
  });

  it('detects explicit GOTO and extracts the file', () => {
    expect(parseHandoverIntent('go to auth.ts')).toEqual({ kind: 'goto', file: 'auth.ts' });
    expect(parseHandoverIntent('show me src/core/login.ts')).toEqual({ kind: 'goto', file: 'src/core/login.ts' });
    expect(parseHandoverIntent('open package.json')).toEqual({ kind: 'goto', file: 'package.json' });
    expect(parseHandoverIntent('jump to the Chat.tsx file')).toEqual({ kind: 'goto', file: 'chat.tsx' });
  });

  it('resolves a bare filename to GOTO when it names a plan file', () => {
    expect(parseHandoverIntent('auth.ts', STEPS)).toEqual({ kind: 'goto', file: 'auth.ts' });
    expect(parseHandoverIntent('the Chat.tsx file', STEPS)).toEqual({ kind: 'goto', file: 'chat.tsx' });
  });

  it('"go to the next file" is NEXT, not GOTO', () => {
    expect(kind('go to the next file', STEPS)).toBe('next');
  });

  it('only STARTS when "walk me through" targets the PR — not the architecture / a flow', () => {
    expect(kind('walk me through this PR')).toBe('start');
    expect(kind('walk me through the changes')).toBe('start');
    // These are explain/lens requests, not a PR walkthrough → fall through (null).
    expect(kind('walk me through the architecture')).toBeNull();
    expect(kind('walk me through the auth flow')).toBeNull();
  });

  it('treats "start from/with/at <file>" as a GOTO to that file (the "start from the risk summary" bug)', () => {
    expect(parseHandoverIntent('start from the risk summary')?.kind).toBe('goto');
    expect(parseHandoverIntent('start with riskSummary.ts')).toEqual({ kind: 'goto', file: 'risksummary.ts' });
    expect(parseHandoverIntent('begin at the auth file')?.kind).toBe('goto');
  });

  it('detects RESUME incl. replay — "play it again" / "hear it again" / "repeat" (the "didn\'t replay" bug)', () => {
    for (const t of [
      'resume',
      'where were we',
      'pick up where we left off',
      'continue the walkthrough',
      'replay',
      'play it again',
      'hear that again',
      'repeat',
      'once more',
      'read it again',
    ])
      expect(kind(t)).toBe('resume');
  });

  it('detects STOP', () => {
    for (const t of ['stop', 'quit', 'exit handover', 'stop the walkthrough', 'end the tour']) expect(kind(t)).toBe('stop');
  });

  it('detects STATUS (and "what\'s next" is status, not next)', () => {
    for (const t of ["what's the plan", "what's left", "what's next", 'where are we', 'show me the plan', 'how far along are we'])
      expect(kind(t)).toBe('status');
  });

  it('detects DEEPER (explicit deepening phrases) and carries the query', () => {
    for (const t of [
      'go deeper',
      'can you go deeper on this?',
      'tell me more',
      'explain this further',
      'explain how it works',
      'I have a question',
      "I've got a question about this",
      'break it down',
      'elaborate',
      'dig into the retry logic',
      'more detail please',
    ]) {
      const a = parseHandoverIntent(t, STEPS);
      expect(a?.kind).toBe('deeper');
      if (a?.kind === 'deeper') expect(a.query).toBe(t.trim());
    }
  });

  it('does NOT confuse "go deeper" with "next", nor "play it again" with deeper', () => {
    expect(kind('go deeper')).toBe('deeper'); // starts with "go" but is NOT next
    expect(kind('next')).toBe('next');
    expect(kind('continue')).toBe('next');
    expect(kind('play it again')).toBe('resume'); // replay the same beats, not a deeper dive
    expect(kind('go over it again')).toBe('resume');
  });

  it('returns null for real questions / chit-chat (falls through to the lenses)', () => {
    for (const t of [
      'what does auth.ts do?',
      'why was this changed?',
      'explain the login flow',
      'is this tested?',
      'hello',
      '',
      '   ',
    ])
      expect(kind(t, STEPS)).toBeNull();
  });
});
