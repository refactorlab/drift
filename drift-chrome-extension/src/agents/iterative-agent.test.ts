import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runIterativeAgent,
  selectFiles,
  findUngroundedCitations,
  groundCitations,
  capHeadTail,
  truncateToTokens,
  COMPACT_AT_TOKENS,
  DEFAULT_MAX_FILES,
} from './iterative-agent';
import { getPrFile } from '../state/prFileStore';
import type { BrainRuntime } from '../core/brainRuntime';
import type { ChatTurn } from '../core/chatContext';

vi.mock('../state/prFileStore', () => ({ getPrFile: vi.fn() }));
const mockGetPrFile = vi.mocked(getPrFile);

interface FakeCalls {
  summaries: number;
  answers: number;
}

/** A scripted BrainRuntime. There is NO per-step decision call anymore — only
 *  summaries (when over budget) and ONE final answer. `complete` must never run. */
function fakeBrain(answer: string): { brain: BrainRuntime; calls: FakeCalls } {
  const calls: FakeCalls = { summaries: 0, answers: 0 };
  const brain: BrainRuntime = {
    async complete() {
      throw new Error('runIterativeAgent must not make a decision/router call');
    },
    async generate(messages: ChatTurn[]) {
      if ((messages[0]?.content ?? '').startsWith('Summarize')) {
        calls.summaries++;
        return 'file summary';
      }
      calls.answers++;
      return answer;
    },
    interrupt() {},
    free() {},
  };
  return { brain, calls };
}

const FILES = [
  { path: 'a.ts', status: 'M' },
  { path: 'b.ts', status: 'M' },
];

beforeEach(() => {
  mockGetPrFile.mockReset();
  mockGetPrFile.mockImplementation(async (_url: string, _sha: string, path: string) => ({
    path,
    status: 'M',
    content: `content of ${path}\n`.repeat(3),
    diff: '',
  }));
});

describe('runIterativeAgent (deterministic selection, one answer)', () => {
  it('reads the selected files (no LLM decision calls) and answers once', async () => {
    const { brain, calls } = fakeBrain('FINAL ANSWER');
    const res = await runIterativeAgent({
      brain,
      question: 'how does it work?',
      architecture: 'arch map',
      url: 'u',
      sha: 's',
      files: FILES,
      signal: new AbortController().signal,
    });
    expect(res.readPaths.sort()).toEqual(['a.ts', 'b.ts']);
    expect(res.answer).toBe('FINAL ANSWER');
    expect(mockGetPrFile).toHaveBeenCalledTimes(2);
    expect(calls.answers).toBe(1); // exactly ONE answer generation
    expect(calls.summaries).toBe(0); // small set fits the window → no summary calls
  });

  it('grounds the answer in the CHANGE — shows the diff, and flags a NEW file whose diff is empty', async () => {
    const prompts: string[] = [];
    const brain: BrainRuntime = {
      async complete() {
        throw new Error('no router call');
      },
      async generate(messages: ChatTurn[]) {
        const sys = messages[0]?.content ?? '';
        if (!sys.startsWith('Summarize')) prompts.push(sys); // the final answer prompt
        return 'A';
      },
      interrupt() {},
      free() {},
    };
    mockGetPrFile.mockImplementation(async (_u: string, _s: string, path: string) =>
      path === 'mod.ts'
        ? { path, status: 'M', content: 'current state of mod', diff: '@@ -1,2 +1,2 @@\n-old line\n+new line' }
        : { path, status: 'A', content: 'brand new content', diff: '' },
    );
    await runIterativeAgent({
      brain,
      question: 'what is the change?',
      architecture: 'arch',
      url: 'u',
      sha: 's',
      files: [
        { path: 'mod.ts', status: 'M' },
        { path: 'new.ts', status: 'A' },
      ],
      signal: new AbortController().signal,
    });
    const prompt = prompts.join('\n');
    // The modified file shows its DIFF (the actual change), not just the current content.
    expect(prompt).toContain('the change');
    expect(prompt).toContain('+ added');
    expect(prompt).toContain('-old line');
    expect(prompt).toContain('+new line');
    // The NEW file (no cached diff) is flagged so the model knows its content IS the change.
    expect(prompt).toContain('NEW file');
  });

  it('caps how many files it reads (maxFiles)', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ path: `f${i}.ts`, status: 'M' }));
    const { brain } = fakeBrain('A');
    const res = await runIterativeAgent({
      brain,
      question: 'q',
      architecture: 'arch',
      url: 'u',
      sha: 's',
      files: many,
      signal: new AbortController().signal,
      maxFiles: 3,
    });
    expect(res.readPaths).toHaveLength(3);
    expect(mockGetPrFile).toHaveBeenCalledTimes(3);
  });

  it('defaults to DEFAULT_MAX_FILES when not capped', async () => {
    const many = Array.from({ length: DEFAULT_MAX_FILES + 5 }, (_, i) => ({ path: `f${i}.ts`, status: 'M' }));
    const { brain } = fakeBrain('A');
    const res = await runIterativeAgent({
      brain,
      question: 'q',
      architecture: 'arch',
      url: 'u',
      sha: 's',
      files: many,
      signal: new AbortController().signal,
    });
    expect(res.readPaths).toHaveLength(DEFAULT_MAX_FILES);
  });

  it('answers immediately when there are no files', async () => {
    const { brain, calls } = fakeBrain('NO FILES');
    const res = await runIterativeAgent({
      brain,
      question: 'q',
      architecture: 'arch',
      url: 'u',
      sha: 's',
      files: [],
      signal: new AbortController().signal,
    });
    expect(res.readPaths).toEqual([]);
    expect(res.answer).toBe('NO FILES');
    expect(calls.answers).toBe(1);
    expect(mockGetPrFile).not.toHaveBeenCalled();
  });

  it('map-reduce: summarizes the read files only when over the window', async () => {
    const bigArch = 'token '.repeat(COMPACT_AT_TOKENS + 200); // architecture alone blows the budget
    const { brain, calls } = fakeBrain('SUMMARIZED ANSWER');
    const res = await runIterativeAgent({
      brain,
      question: 'q',
      architecture: bigArch,
      url: 'u',
      sha: 's',
      files: FILES,
      signal: new AbortController().signal,
    });
    expect(calls.summaries).toBeGreaterThanOrEqual(1); // compaction fired
    expect(calls.answers).toBe(1);
    expect(res.answer).toBe('SUMMARIZED ANSWER');
  });

  it('compacts the LEAST-relevant (tail) files first, keeping top files full', async () => {
    mockGetPrFile.mockImplementation(async (_u: string, _s: string, path: string) => ({
      path,
      status: 'M',
      content: `MARKER_${path} ` + 'word '.repeat(600), // > per-file cap → capHeadTail, marker stays in head
      diff: '',
    }));
    let summaries = 0;
    let answerSystem = '';
    const brain: BrainRuntime = {
      async complete() {
        throw new Error('no decision call');
      },
      async generate(messages: ChatTurn[]) {
        if (messages[0].content.startsWith('Summarize')) {
          summaries++;
          return 'file summary';
        }
        answerSystem = messages[0].content;
        return 'A';
      },
      interrupt() {},
      free() {},
    };
    const files = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ path: `${n}.ts`, status: 'M' }));
    await runIterativeAgent({ brain, question: 'q', architecture: 'arch', url: 'u', sha: 's', files, signal: new AbortController().signal });
    expect(summaries).toBeGreaterThan(0); // over budget → compaction fired
    expect(summaries).toBeLessThan(files.length); // PARTIAL — not everything summarized
    expect(answerSystem).toContain('MARKER_a.ts'); // top-ranked file kept full
    expect(answerSystem).not.toContain('MARKER_e.ts'); // tail file was summarized
    expect(answerSystem).toContain('file summary');
  });

  it('tells the model when only the top-N of M changed files were inspected', async () => {
    let answerSystem = '';
    const brain: BrainRuntime = {
      async complete() {
        throw new Error('no decision call');
      },
      async generate(messages: ChatTurn[]) {
        answerSystem = messages[0].content;
        return 'A';
      },
      interrupt() {},
      free() {},
    };
    const files = Array.from({ length: 20 }, (_, i) => ({ path: `f${i}.ts`, status: 'M' }));
    await runIterativeAgent({ brain, question: 'q', architecture: 'arch', url: 'u', sha: 's', files, signal: new AbortController().signal, maxFiles: 3 });
    expect(answerSystem).toContain('of 20');
    expect(answerSystem.toLowerCase()).toContain('most relevant');
  });

  it('aborts cleanly: no reads, still returns an answer', async () => {
    const ac = new AbortController();
    ac.abort();
    const { brain } = fakeBrain('ABORTED ANSWER');
    const res = await runIterativeAgent({
      brain,
      question: 'q',
      architecture: 'arch',
      url: 'u',
      sha: 's',
      files: FILES,
      signal: ac.signal,
    });
    expect(res.readPaths).toEqual([]);
    expect(mockGetPrFile).not.toHaveBeenCalled();
  });
});

describe('task lens', () => {
  it('weaves the lens instruction + answerFormat into the answer prompt', async () => {
    const generateSystems: string[] = [];
    const brain: BrainRuntime = {
      async complete() {
        throw new Error('no decision call');
      },
      async generate(messages: ChatTurn[]) {
        generateSystems.push(messages[0].content);
        return 'ANSWER';
      },
      interrupt() {},
      free() {},
    };
    await runIterativeAgent({
      brain,
      question: 'q',
      architecture: 'arch',
      url: 'u',
      sha: 's',
      files: [{ path: 'a.ts', status: 'M' }],
      signal: new AbortController().signal,
      lens: { instruction: 'FOCUS ON BREAKING CHANGES', answerFormat: 'List each change.' },
    });
    expect(generateSystems.some((s) => s.includes('FOCUS ON BREAKING CHANGES'))).toBe(true);
    expect(generateSystems.some((s) => s.includes('List each change.'))).toBe(true);
  });
});

describe('answerFormat (output shape rides the SYSTEM prompt, not the user turn)', () => {
  it('puts the requested structure in the answer system prompt — where a 1.5B model actually obeys it', async () => {
    let answerSystem = '';
    let answerUser = '';
    const brain: BrainRuntime = {
      async complete() {
        throw new Error('no decision call');
      },
      async generate(messages: ChatTurn[]) {
        answerSystem = messages[0].content;
        answerUser = messages[1]?.content ?? '';
        return 'ANSWER';
      },
      interrupt() {},
      free() {},
    };
    await runIterativeAgent({
      brain,
      question: 'what is this file about?',
      answerFormat: 'Level 1 — PR change. Level 2 — what the file does. Level 3 — the changes.',
      architecture: 'arch',
      url: 'u',
      sha: 's',
      files: [{ path: 'a.ts', status: 'M' }],
      signal: new AbortController().signal,
    });
    // The output SHAPE must be in the SYSTEM prompt (the user turn alone was the bug)…
    expect(answerSystem).toContain('Level 1 — PR change');
    expect(answerSystem).toContain('Level 3 — the changes');
    // …and the actual question stays in the user turn.
    expect(answerUser).toContain('what is this file about?');
    expect(answerUser).not.toContain('Level 1 — PR change');
  });
});

describe('selectFiles (deterministic ranking)', () => {
  const files = [
    { path: 'src/core/a.ts', status: 'M' },
    { path: 'src/core/zebra.ts', status: 'M' },
    { path: 'src/core/b.ts', status: 'M' },
  ];

  it('floats files the QUESTION names to the front (aider personalization seed)', () => {
    const ranked = selectFiles(files, 'what changed in zebra.ts?');
    expect(ranked[0].path).toBe('src/core/zebra.ts');
  });

  it('matches by basename without extension too', () => {
    const ranked = selectFiles(files, 'walk me through the zebra module');
    expect(ranked[0].path).toBe('src/core/zebra.ts');
  });

  it('falls back to the lens bias when nothing is named', () => {
    const ranked = selectFiles(files, 'give me an overview', { instruction: 'x', rankFiles: (fs) => [...fs].reverse() });
    expect(ranked.map((f) => f.path)).toEqual(['src/core/b.ts', 'src/core/zebra.ts', 'src/core/a.ts']);
  });

  it('is stable (original order) with no lens and no mention', () => {
    expect(selectFiles(files, 'hello').map((f) => f.path)).toEqual(files.map((f) => f.path));
  });
});

describe('citation grounding (external-oracle check, no self-critique)', () => {
  const known = [
    { path: 'src/core/prDiff.ts', status: 'M' },
    { path: 'drift-chrome-extension/src/agents/iterative-agent.ts', status: 'A' },
  ];

  it('flags a cited path that is not in the PR changed set', () => {
    expect(findUngroundedCitations('I changed src/core/vendor-volley.ts heavily.', known)).toEqual([
      'src/core/vendor-volley.ts',
    ]);
  });

  it('accepts a real changed file by full path OR basename', () => {
    expect(findUngroundedCitations('See src/core/prDiff.ts', known)).toEqual([]);
    // basename match — the model cited a shorter path than the stored one
    expect(findUngroundedCitations('See src/agents/iterative-agent.ts', known)).toEqual([]);
  });

  it('does not flag prose framework names without a slash (e.g. Node.js)', () => {
    expect(findUngroundedCitations('This runs on Node.js and uses package.json.', known)).toEqual([]);
  });

  it('groundCitations appends an honest caveat only when something is ungrounded', () => {
    expect(groundCitations('All good, see src/core/prDiff.ts', known)).toBe('All good, see src/core/prDiff.ts');
    const out = groundCitations('I rewrote src/made/up.ts', known);
    expect(out).toContain('treat as uncertain');
    expect(out).toContain('src/made/up.ts');
  });
});

describe('token capping', () => {
  it('capHeadTail keeps head+tail and elides the middle when over budget', () => {
    const text = Array.from({ length: 400 }, (_, i) => `line ${i}`).join('\n');
    const capped = capHeadTail(text, 60);
    expect(capped).toContain('line 0');
    expect(capped).toContain('lines elided');
    expect(capped.length).toBeLessThan(text.length);
  });

  it('capHeadTail is a no-op under budget', () => {
    expect(capHeadTail('short', 100)).toBe('short');
  });

  it('truncateToTokens marks the cut', () => {
    expect(truncateToTokens('word '.repeat(500), 50)).toContain('truncated');
  });
});
