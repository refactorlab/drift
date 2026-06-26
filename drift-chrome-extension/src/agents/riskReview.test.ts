import { describe, it, expect, vi } from 'vitest';
import {
  buildBlastContext,
  buildHotspotContext,
  buildIntentContext,
  BLAST_CAVEAT,
  mapMessages,
  reduceMessages,
  verifyMessages,
  needsVerify,
  rankFilesForRisk,
  findingsForFile,
  groundMapNote,
  runRiskReview,
} from './riskReview';
import { buildRiskBrief } from './riskBrief';
import type { ReadableFile } from './iterative-agent';
import type { BrainRuntime } from '../core/brainRuntime';
import { listPrFiles, getPrFile } from '../state/prFileStore';
import { collectFileDiff } from './changeCollector';
import sample from '../app/__fixtures__/sampleScan.json';

vi.mock('../state/prFileStore', () => ({
  listPrFiles: vi.fn(),
  getPrFile: vi.fn(),
}));
vi.mock('./changeCollector', () => ({
  collectFileDiff: vi.fn(),
}));

describe('buildBlastContext — call-graph breaking-change grounding', () => {
  const blast = buildBlastContext(sample);
  const rows = blast.split('\n').filter((l) => l.startsWith('- '));

  it('produces caller/callee rows for the changed symbols', () => {
    expect(blast).toBeTruthy();
    expect(blast).toMatch(/called by|calls /);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('tags each row with its diff class and frames callers as the breakage surface', () => {
    expect(blast).toMatch(/\[(added|changed|removed)\]/);
    expect(blast).toContain('these break if its contract changes');
  });

  it('caps the rows (highest fan-in first)', () => {
    expect(rows.length).toBeLessThanOrEqual(8);
  });

  it('marks the caller set as a LOWER BOUND (static call graphs miss dynamic edges)', () => {
    // Research-backed honesty cue: absent callers must not read as "safe".
    expect(blast).toContain(BLAST_CAVEAT);
    expect(blast.toLowerCase()).toContain('lower bound');
  });

  it('returns empty string when there is no structured call graph', () => {
    expect(buildBlastContext({ pr_review: {} })).toBe('');
    expect(buildBlastContext({ schema: 'derived' })).toBe('');
    expect(buildBlastContext(null)).toBe('');
  });
});

describe('buildHotspotContext — only CONCRETE findings as leads (no aggregate metrics)', () => {
  const brief = buildRiskBrief(sample)!;
  const hotspots = buildHotspotContext(brief);

  it('carries the concrete finding messages (the XSS sink) so the brain verifies them', () => {
    expect(hotspots).toMatch(/dangerouslySetInnerHTML|XSS/i);
  });

  it('EXCLUDES aggregate risk labels — the statistics the review must not parrot', () => {
    // These are the exact phrases the unhelpful output kept reciting; they are
    // statistics, not logical risks, so they must not be fed as "leads".
    expect(hotspots).not.toContain('risk flagged:');
    expect(hotspots).not.toMatch(/wide blast radius|uncovered roots|lack retry\/timeout|high-complexity functions/i);
  });

  it('every lead is a concrete file/line finding, capped', () => {
    const lines = hotspots.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(8);
    for (const l of lines) expect(l.startsWith('- ')).toBe(true);
  });
});

describe('buildIntentContext — the author’s stated intent (for the change summary + scope-creep check)', () => {
  it('surfaces title, description, and commit subjects', () => {
    const rec = {
      title: 'Add member editor',
      description: 'Lets a user edit their display name and colour from the member screen.',
      commits: ['feat: member editor\n\nbody', 'fix: colour picker'],
      scan: {},
    } as unknown as Parameters<typeof buildIntentContext>[0];
    const out = buildIntentContext(rec);
    expect(out).toContain('Title: Add member editor');
    expect(out).toContain('edit their display name');
    expect(out).toContain('feat: member editor');
    expect(out).not.toContain('body'); // commit subject only
  });

  it('falls back to the scan’s pr_description when the record has none', () => {
    const rec = { title: null, description: null, commits: [], scan: { pr_review: {}, pr_description: 'Scan-side intent.' } } as unknown as Parameters<typeof buildIntentContext>[0];
    expect(buildIntentContext(rec)).toContain('Scan-side intent.');
  });
});

const file = (path: string, status = 'M'): ReadableFile => ({ path, status });

describe('mapMessages — the per-file MAP prompt encodes the measured levers', () => {
  const msgs = mapMessages('Title: add X', file('Member.tsx'), '- reliability: XSS sink (Member.tsx:9)', '+ added line');
  const system = msgs[0].content;
  const user = msgs[1].content;

  it('requires a concrete trigger and splits confirmed vs possible (the FN-hallucination mitigation)', () => {
    expect(system).toContain('CONCRETE TRIGGER');
    expect(system).toContain('(confirmed)');
    expect(system).toContain('(possible)');
  });

  it('gives an explicit "Looks correct" escape hatch (counters over-rejection)', () => {
    expect(system).toMatch(/Looks correct/);
  });

  it('few-shots a GOOD and a BAD finding (the biggest measured lever), labelled format-only', () => {
    expect(system).toMatch(/GOOD finding/);
    expect(system).toMatch(/BAD —/);
    // The example is explicitly format-only so the model can't parrot it as a real finding.
    expect(system).toMatch(/never copy/i);
  });

  it('constrains output (no rewrites / real symbols / no generated code)', () => {
    expect(system).toMatch(/never propose rewrites/i);
    expect(system).toMatch(/do not output any code/i);
  });

  it('grounds the user turn in the intent, the file, the leads, and the actual change', () => {
    expect(user).toContain('Title: add X');
    expect(user).toContain('Member.tsx');
    expect(user).toContain('XSS sink');
    expect(user).toContain('+ added line');
  });
});

describe('reduceMessages — synthesis prompt is grounded and noise-disciplined', () => {
  it('text mode splits Confirmed vs Worth-checking and forbids inventing/reciting', () => {
    const sys = reduceMessages('Title: x', '### a.ts\n- bug (a.ts:1) (confirmed: y)', 'graph', '', false)[0].content;
    expect(sys).toContain('Confirmed');
    expect(sys).toContain('Worth checking');
    expect(sys).toMatch(/do NOT introduce new problems/);
    expect(sys).toMatch(/do NOT recite scanner metrics/);
  });

  it('voice mode asks for a short spoken review with no headers', () => {
    const sys = reduceMessages('', 'notes', '', '', true)[0].content;
    expect(sys).toMatch(/spoken/i);
    expect(sys).toMatch(/no headers/i);
  });

  it('carries the notes, intent, call graph, and omitted-files note into the user turn', () => {
    const user = reduceMessages('Title: x', '### a.ts\n- bug', 'A calls B', '(3 more …)', false)[1].content;
    expect(user).toContain('Title: x');
    expect(user).toContain('- bug');
    expect(user).toContain('A calls B');
    expect(user).toContain('(3 more …)');
  });
});

describe('verify gating + pruning prompt', () => {
  it('needsVerify fires only when there is a Confirmed item in a substantial draft', () => {
    const draft =
      '**What this PR changes**\nAdds the foo helper used by the list renderer.\n' +
      '**What could break**\nConfirmed:\n- Null deref: foo(x) when x is undefined (a.ts:1)\nMost important before merge: guard x.';
    expect(draft.length).toBeGreaterThan(120);
    expect(needsVerify(draft)).toBe(true);
    expect(needsVerify('Nothing blocks merge.')).toBe(false);
    expect(needsVerify('Confirmed')).toBe(false); // has the word but too short to be a real draft
  });

  it('verifyMessages instructs pruning of ungrounded confirmed findings without adding new ones', () => {
    const sys = verifyMessages('draft', 'notes')[0].content;
    expect(sys).toMatch(/FALSE POSITIVES/);
    expect(sys).toMatch(/do NOT add anything new/i);
  });
});

describe('rankFilesForRisk / findingsForFile', () => {
  it('floats scanner-hot files, then source, above the rest', () => {
    const files = [file('readme.md'), file('b.test.ts'), file('plain.ts'), file('hot.ts')];
    const ranked = rankFilesForRisk(files, new Set(['hot.ts'])).map((f) => f.path);
    expect(ranked[0]).toBe('hot.ts'); // hot wins
    expect(ranked.indexOf('plain.ts')).toBeLessThan(ranked.indexOf('readme.md')); // source above docs
  });

  it('selects only the findings located in a given file', () => {
    const findings = [
      { message: 'a-issue', where: 'a.ts:1', category: 'bug' },
      { message: 'b-issue', where: 'b.ts:9' },
    ] as Parameters<typeof findingsForFile>[0];
    const out = findingsForFile(findings, 'a.ts');
    expect(out).toContain('a-issue');
    expect(out).not.toContain('b-issue');
  });
});

describe('groundMapNote — strips parroted cross-file findings (the few-shot example leak)', () => {
  const changed = new Set(['src/core/geminiLiveController.ts', 'src/agents/handover.ts']);

  it('drops a finding citing a file NOT under review or in the PR (the Member.tsx leak)', () => {
    const note =
      '- Off-by-one: rows[rows.length] → crash (Member.tsx:42) (confirmed)\n' +
      '- Missing await on session.close() (geminiLiveController.ts:468) (confirmed)';
    const out = groundMapNote(note, 'src/core/geminiLiveController.ts', changed);
    expect(out).not.toContain('Member.tsx'); // parroted example removed
    expect(out).toContain('geminiLiveController.ts:468'); // the real finding kept
  });

  it('keeps general lines with no file citation, and matches the reviewed file by basename', () => {
    expect(groundMapNote('- Risky overall, no clear trigger', 'a.ts', changed)).toContain('Risky overall');
    expect(groundMapNote('- bug (geminiLiveController.ts:5)', 'src/core/geminiLiveController.ts', changed)).toContain('geminiLiveController.ts:5');
  });

  it('does not mistake prose like `rows.length` / `session.close()` for a file reference', () => {
    const note = '- `i <= rows.length` reads `rows[rows.length]` (geminiLiveController.ts:10) (confirmed)';
    expect(groundMapNote(note, 'src/core/geminiLiveController.ts', changed)).toContain('rows.length');
  });

  it('returns empty when EVERY line cites a foreign file (a fully fabricated note)', () => {
    expect(groundMapNote('- bug (Member.tsx:42)\n- bug2 (Other.tsx:9)', 'a.ts', changed)).toBe('');
  });
});

describe('runRiskReview — MAP → REDUCE → VERIFY orchestration (fake brain + mocked store)', () => {
  it('maps each changed file, reduces the notes, and verifies when a Confirmed item exists', async () => {
    vi.mocked(listPrFiles).mockResolvedValue([
      { path: 'a.ts', status: 'M' },
      { path: 'b.ts', status: 'M' },
    ] as never);
    vi.mocked(getPrFile).mockImplementation(
      (async (_u: string, _s: string, path: string) => ({ path, status: 'M', content: `content of ${path}`, diff: `+ change in ${path}` })) as never,
    );

    const calls: string[] = [];
    const brain = {
      generate: async (msgs: { role: string; content: string }[]) => {
        const sys = msgs[0].content;
        if (sys.includes('reviewing the change to ONE file')) {
          calls.push('map');
          return '- Null deref: foo(x) when x is undefined (a.ts:3) (confirmed: x=undefined)';
        }
        if (sys.includes('FINAL risk review')) {
          calls.push('reduce');
          return '**What this PR changes**\nAdds foo.\n**What could break**\nConfirmed:\n- Null deref (a.ts:3)\nMost important before merge: guard x.';
        }
        if (sys.includes('pruning a draft')) {
          calls.push('verify');
          return '**What this PR changes**\nAdds foo.\n**What could break**\nConfirmed:\n- Null deref (a.ts:3)\nMost important before merge: guard x.';
        }
        return '';
      },
    } as unknown as BrainRuntime;

    const rec = {
      url: 'https://github.com/o/r/pull/1',
      sha: 'sha1',
      owner: 'o',
      repo: 'r',
      number: 1,
      title: 'Add foo',
      commits: ['feat: foo'],
      description: 'Adds foo helper.',
      scan: {},
    } as never;

    const out = await runRiskReview({ rec, brain, userText: "what's the risk", signal: new AbortController().signal });

    expect(calls.filter((c) => c === 'map')).toHaveLength(2); // one MAP per changed file
    expect(calls).toContain('reduce');
    expect(calls).toContain('verify'); // Confirmed item → verify pass ran
    expect(out.readPaths).toEqual(['a.ts', 'b.ts']);
    expect(out.content).toContain('What this PR changes');
    expect(out.content).toContain('Most important before merge');
  });

  it('STILL runs the brain when the file cache was evicted — files from the record, diffs from GitHub', async () => {
    // The reported bug: a scan restored from history has an empty file cache, so the MAP loop
    // read zero files and silently dumped the deterministic brief instead of reviewing.
    vi.mocked(listPrFiles).mockResolvedValue([] as never); // cache evicted
    vi.mocked(getPrFile).mockResolvedValue(null as never); // nothing cached
    vi.mocked(collectFileDiff).mockImplementation((async ({ path }: { path: string }) => `+ change in ${path}`) as never);

    const calls: string[] = [];
    const brain = {
      generate: async (msgs: { role: string; content: string }[]) => {
        const sys = msgs[0].content;
        if (sys.includes('reviewing the change to ONE file')) {
          calls.push('map');
          return '- Null deref: foo(x) when x is undefined (x.ts:3) (confirmed: x=undefined)';
        }
        if (sys.includes('FINAL risk review')) {
          calls.push('reduce');
          return '**What this PR changes**\nAdds x.\n**What could break**\nWorth checking:\n- maybe null (x.ts:3)\nNothing blocks merge.';
        }
        return '';
      },
    } as unknown as BrainRuntime;

    const rec = {
      url: 'https://github.com/o/r/pull/83',
      sha: 'evicted-sha',
      owner: 'o',
      repo: 'r',
      number: 83,
      title: 'T',
      commits: [],
      description: null,
      scan: {},
      changedStatus: [{ code: 'M', path: 'x.ts', additions: 3, deletions: 0 }],
    } as never;

    const out = await runRiskReview({
      rec,
      pr: { owner: 'o', repo: 'r', number: 83, host: 'github.com' },
      brain,
      userText: 'risk?',
      signal: new AbortController().signal,
    });

    expect(vi.mocked(collectFileDiff)).toHaveBeenCalled(); // fetched the diff from GitHub
    expect(calls).toContain('map'); // the brain WAS initiated despite the empty cache
    expect(calls).toContain('reduce');
    expect(out.readPaths).toEqual(['x.ts']);
    expect(out.content).toContain('What this PR changes');
  });

  it('FILE-SCOPED (focusPaths) reviews ONLY the given file, with no whole-PR verdict header', async () => {
    vi.mocked(listPrFiles).mockResolvedValue([
      { path: 'a.ts', status: 'M' },
      { path: 'b.ts', status: 'M' },
      { path: 'c.ts', status: 'M' },
    ] as never);
    vi.mocked(getPrFile).mockImplementation(
      (async (_u: string, _s: string, path: string) => ({ path, status: 'M', content: 'x', diff: `+ change in ${path}` })) as never,
    );

    const mapped: string[] = [];
    const brain = {
      generate: async (msgs: { role: string; content: string }[]) => {
        const sys = msgs[0].content;
        if (sys.includes('reviewing the change to ONE file')) {
          mapped.push(msgs[1].content.match(/File: (\S+)/)?.[1] ?? '');
          return '- Null deref (b.ts:3) (confirmed: x undefined)';
        }
        if (sys.includes('FINAL risk review')) {
          return '**What this PR changes**\nTweaks b.\n**What could break**\nWorth checking:\n- maybe null (b.ts:3)\nNothing blocks merge.';
        }
        return '';
      },
    } as unknown as BrainRuntime;

    const rec = { url: 'u', sha: 's', owner: 'o', repo: 'r', number: 1, title: 'T', commits: [], description: null, scan: {} } as never;
    const out = await runRiskReview({ rec, focusPaths: ['b.ts'], brain, userText: 'risk in this file?', signal: new AbortController().signal });

    expect(mapped).toEqual(['b.ts']); // only the focused file was reviewed, not a or c
    expect(out.readPaths).toEqual(['b.ts']);
    expect(out.content).not.toMatch(/merge confidence/i); // no PR-level verdict header on a file review
    expect(out.content).toContain('What this PR changes');
  });

  it('falls back to an honest "no concrete risks" message when every file looks correct', async () => {
    vi.mocked(listPrFiles).mockResolvedValue([{ path: 'a.ts', status: 'M' }] as never);
    vi.mocked(getPrFile).mockImplementation((async (_u: string, _s: string, path: string) => ({ path, status: 'M', content: 'c', diff: '+ x' })) as never);
    const brain = { generate: async () => 'Looks correct.' } as unknown as BrainRuntime;
    const rec = { url: 'u', sha: 's', owner: 'o', repo: 'r', number: 1, title: 'T', commits: [], description: null, scan: {} } as never;

    const out = await runRiskReview({ rec, brain, userText: 'risk?', signal: new AbortController().signal });
    expect(out.content.toLowerCase()).toContain('no concrete logical risks');
    expect(out.readPaths).toEqual(['a.ts']);
  });
});
