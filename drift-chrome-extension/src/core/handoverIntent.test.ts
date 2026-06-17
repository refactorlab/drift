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

  it('detects RESUME', () => {
    for (const t of ['resume', 'where were we', 'pick up where we left off', 'continue the walkthrough'])
      expect(kind(t)).toBe('resume');
  });

  it('detects STOP', () => {
    for (const t of ['stop', 'quit', 'exit handover', 'stop the walkthrough', 'end the tour']) expect(kind(t)).toBe('stop');
  });

  it('detects STATUS (and "what\'s next" is status, not next)', () => {
    for (const t of ["what's the plan", "what's left", "what's next", 'where are we', 'show me the plan', 'how far along are we'])
      expect(kind(t)).toBe('status');
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
