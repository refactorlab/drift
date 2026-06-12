import { describe, it, expect, beforeEach } from 'vitest';
import { wasAutoHandled, markAutoHandled, __resetSessionScans } from './sessionScan';

describe('sessionScan — once-per-session auto-scan guard', () => {
  beforeEach(() => __resetSessionScans());

  it('reports a url as unhandled until it is marked, then handled', () => {
    const url = 'https://github.com/acme/web/pull/7';
    expect(wasAutoHandled(url)).toBe(false);
    markAutoHandled(url);
    expect(wasAutoHandled(url)).toBe(true);
  });

  it('tracks urls independently', () => {
    markAutoHandled('https://github.com/a/b/pull/1');
    expect(wasAutoHandled('https://github.com/a/b/pull/2')).toBe(false);
  });

  it('reset clears the session set', () => {
    markAutoHandled('x');
    __resetSessionScans();
    expect(wasAutoHandled('x')).toBe(false);
  });
});
