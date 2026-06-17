import { describe, it, expect } from 'vitest';
import { isGithubHost, isGithubUrl, ghWebBase, ghApiBase } from './githubHost';

describe('isGithubHost', () => {
  it('accepts public github.com', () => {
    expect(isGithubHost('github.com')).toBe(true);
  });
  it('accepts GitHub Enterprise hosts (github.<org>.<tld>)', () => {
    expect(isGithubHost('github.intuit.com')).toBe(true);
    expect(isGithubHost('github.my-enterprise.com')).toBe(true);
    expect(isGithubHost('github.acme.co.uk')).toBe(true);
  });
  it('rejects non-GitHub and look-alike hosts', () => {
    expect(isGithubHost('gist.github.com')).toBe(false); // not a github.<org> host
    expect(isGithubHost('github.io')).toBe(false); // GitHub Pages, single label
    expect(isGithubHost('mygithub.com')).toBe(false);
    expect(isGithubHost('githubusercontent.com')).toBe(false);
    expect(isGithubHost('example.com')).toBe(false);
  });
});

describe('isGithubUrl', () => {
  it('recognises github URLs and rejects others / garbage', () => {
    expect(isGithubUrl('https://github.com/a/b/pull/1')).toBe(true);
    expect(isGithubUrl('https://github.intuit.com/a/b')).toBe(true);
    expect(isGithubUrl('https://example.com')).toBe(false);
    expect(isGithubUrl('not a url')).toBe(false);
    expect(isGithubUrl(undefined)).toBe(false);
  });
});

describe('ghWebBase / ghApiBase', () => {
  it('builds the web origin per host', () => {
    expect(ghWebBase()).toBe('https://github.com');
    expect(ghWebBase('github.intuit.com')).toBe('https://github.intuit.com');
  });
  it('routes the API to api.github.com publicly, /api/v3 on enterprise', () => {
    expect(ghApiBase()).toBe('https://api.github.com');
    expect(ghApiBase('github.com')).toBe('https://api.github.com');
    expect(ghApiBase('github.intuit.com')).toBe('https://github.intuit.com/api/v3');
  });
});
