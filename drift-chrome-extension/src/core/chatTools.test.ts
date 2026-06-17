import { describe, it, expect } from 'vitest';
import {
  EMPTY_PR_STATE,
  getAvailableTools,
  routerSchema,
  parseRouterDecision,
  buildRouterSystemPrompt,
  buildSystemPrompt,
  buildScanContext,
  isMetaQuestion,
  type PrToolState,
  type ScanContextInput,
} from './chatTools';

const PR = { owner: 'o', repo: 'r', number: 7, host: 'github.com' };

const withPr = (over: Partial<PrToolState> = {}): PrToolState => ({
  ...EMPTY_PR_STATE,
  pr: PR,
  url: 'https://github.com/o/r/pull/7',
  title: 'T',
  ...over,
});

describe('tool gating', () => {
  it('no PR → no tools available', () => {
    expect(getAvailableTools(EMPTY_PR_STATE)).toHaveLength(0);
  });

  it('PR open → run_live_pr_scan available; list_changed_files NOT until a scan ran', () => {
    const names = getAvailableTools(withPr()).map((t) => t.name);
    expect(names).toContain('run_live_pr_scan');
    expect(names).not.toContain('list_changed_files');
  });

  it('after a scan → list_changed_files becomes available', () => {
    const names = getAvailableTools(withPr({ scanRan: true })).map((t) => t.name);
    expect(names).toContain('list_changed_files');
  });

  it('scan running → run_live_pr_scan is NOT offered (no double-run)', () => {
    const names = getAvailableTools(withPr({ scanRunning: true })).map((t) => t.name);
    expect(names).not.toContain('run_live_pr_scan');
  });

  it('after a scan → the specialized question agents are all available', () => {
    const names = getAvailableTools(withPr({ scanRan: true })).map((t) => t.name);
    for (const id of [
      'summarize_pr_features',
      'explain_business_logic_changes',
      'find_breaking_changes',
      'assess_merge_risk',
      'orient_pr_review',
      'assess_test_coverage',
      'review_security_issues',
      'assess_performance_impact',
      'review_dependency_changes',
      'suggest_improvements',
      'check_code_conventions',
      'review_error_handling',
    ]) {
      expect(names).toContain(id);
    }
  });

  it('the specialized agents are NOT available before a scan', () => {
    const names = getAvailableTools(withPr()).map((t) => t.name);
    expect(names).not.toContain('find_breaking_changes');
  });

  it('after a scan → get_pr_architecture is offered; explain_architecture only once mapped', () => {
    const mapped = getAvailableTools(withPr({ scanRan: true })).map((t) => t.name);
    expect(mapped).toContain('get_pr_architecture');
    expect(mapped).not.toContain('explain_architecture');

    const deep = getAvailableTools(withPr({ scanRan: true, architectureKnown: true })).map((t) => t.name);
    expect(deep).toContain('explain_architecture');
    expect(deep).not.toContain('get_pr_architecture'); // drops out once mapped
  });
});

describe('buildScanContext', () => {
  const base: ScanContextInput = {
    owner: 'o',
    repo: 'r',
    number: 7,
    title: 'Add feature X',
    caption: '3/5 confidence · −1% drift',
    changedCount: 4,
    truncated: false,
    commits: ['feat: add X\n\nlong body here', 'fix: edge case'],
    description: 'This PR adds X to support Y.',
    report: { verdict: 'review', verdictLabel: 'Review recommended' },
  };

  it('feeds the verdict, title, commit SUBJECTS, and description to the model', () => {
    const out = buildScanContext(base);
    expect(out).toContain('Scan complete for o/r#7.');
    expect(out).toContain('Verdict: Review recommended.');
    expect(out).toContain('Title: Add feature X');
    expect(out).toContain('- feat: add X');
    expect(out).not.toContain('long body here'); // body dropped, subject only
    expect(out).toContain('PR description:');
    expect(out).toContain('This PR adds X to support Y.');
  });

  it('truncates a very long description', () => {
    const out = buildScanContext({ ...base, description: 'word '.repeat(5000) });
    expect(out).toContain('(truncated)');
  });

  it('omits optional sections when absent', () => {
    const out = buildScanContext({ ...base, title: null, commits: [], description: null });
    expect(out).not.toContain('Title:');
    expect(out).not.toContain('Commits');
    expect(out).not.toContain('PR description:');
  });
});

describe('router schema (grammar constraint)', () => {
  it('enum is locked to AVAILABLE tools + none', () => {
    const schema = JSON.parse(routerSchema(withPr({ scanRan: true })));
    const enumVals = schema.properties.tool.enum;
    expect(enumVals).toEqual(expect.arrayContaining(['run_live_pr_scan', 'list_changed_files', 'none']));
    expect(schema.required).toEqual(['tool']);
  });

  it('an unavailable tool is NOT in the enum (model cannot pick it)', () => {
    const enumVals = JSON.parse(routerSchema(withPr())).properties.tool.enum; // scan NOT run
    expect(enumVals).not.toContain('list_changed_files');
  });
});

describe('parseRouterDecision', () => {
  const state = withPr();
  it('returns an available tool name', () => {
    expect(parseRouterDecision('{"tool":"run_live_pr_scan"}', state)).toBe('run_live_pr_scan');
  });
  it('"none" → null (answer directly)', () => {
    expect(parseRouterDecision('{"tool":"none"}', state)).toBeNull();
  });
  it('an unavailable tool → null (gated even if the model named it)', () => {
    expect(parseRouterDecision('{"tool":"list_changed_files"}', state)).toBeNull();
  });
  it('tolerates surrounding prose / junk', () => {
    expect(parseRouterDecision('sure: {"tool":"run_live_pr_scan"} ok', state)).toBe('run_live_pr_scan');
  });
  it('malformed JSON → null', () => {
    expect(parseRouterDecision('not json', state)).toBeNull();
  });
});

describe('buildRouterSystemPrompt', () => {
  it('injects live PR/scan state + only the available tools', () => {
    const p = buildRouterSystemPrompt('PERSONA', withPr({ scanRan: true, changedCount: 4 }));
    expect(p).toContain('PERSONA');
    expect(p).toContain('current_pr: o/r#7');
    expect(p).toContain('scan_ran: true');
    expect(p).toContain('changed_files: 4');
    expect(p).toContain('run_live_pr_scan');
    expect(p).toContain('list_changed_files');
  });

  it('leads with the meta/chit-chat guard (rule 1) and drops it to "none"', () => {
    const p = buildRouterSystemPrompt('P', withPr({ scanRan: true }));
    const rulesIdx = p.indexOf('Rules');
    const firstRule = p.slice(rulesIdx).split('\n')[1].toLowerCase();
    expect(firstRule).toContain('what you can do');
    expect(firstRule).toContain('"none"');
  });

  it('only emits rules for tools that are actually selectable (no dead guidance)', () => {
    // Pre-scan: only run_live_pr_scan is available, so no architecture/file rules.
    const preScan = buildRouterSystemPrompt('P', withPr());
    expect(preScan).toContain('run_live_pr_scan');
    expect(preScan).not.toContain('list_changed_files');
    expect(preScan).not.toContain('explain_architecture');
    // No calling-bias hyperbole survives.
    expect(preScan).not.toContain('CRITICAL');
    expect(preScan).not.toContain('ONLY way');
  });

  it('lists routing rules + example questions for the specialized agents after a scan', () => {
    const p = buildRouterSystemPrompt('P', withPr({ scanRan: true }));
    for (const id of [
      'find_breaking_changes',
      'assess_merge_risk',
      'summarize_pr_features',
      'explain_business_logic_changes',
      'orient_pr_review',
      'assess_test_coverage',
      'review_security_issues',
      'assess_performance_impact',
      'review_dependency_changes',
      'suggest_improvements',
      'check_code_conventions',
      'review_error_handling',
    ]) {
      expect(p).toContain(id);
    }
    // rules are generated from each lens's example questions (the routing contract)
    expect(p).toContain('"are there any breaking changes"');
    expect(p).toContain('"what dependencies changed"');
  });
});

describe('isMetaQuestion (deterministic route guard)', () => {
  it('treats capability / "what can you run" questions as meta → no tool', () => {
    for (const q of [
      'What tool functions can you run?',
      'Cool functions can you run?', // the exact misroute from the bug report
      'what can you do',
      'what tools do you have',
      'how do I use you?',
      'who are you',
    ])
      expect(isMetaQuestion(q)).toBe(true);
  });

  it('treats bare greetings / acknowledgements as meta', () => {
    for (const q of ['hi', 'hey!', 'thanks', 'cool', 'ok', 'got it']) expect(isMetaQuestion(q)).toBe(true);
  });

  it('does NOT swallow real PR questions that merely contain "run"/"function"', () => {
    for (const q of [
      'what does the run function do in this PR?',
      'scan the PR',
      'is this change safe?',
      'walk me through the auth flow',
      'cool, can you scan it?',
    ])
      expect(isMetaQuestion(q)).toBe(false);
  });
});

describe('buildSystemPrompt (answer phase)', () => {
  it('lists the FULL tool capabilities so the model can answer "what can you do"', () => {
    const p = buildSystemPrompt('PERSONA', withPr({ scanRan: true }));
    expect(p).toContain('What you can do');
    expect(p).toContain('run_live_pr_scan');
    expect(p).toContain('get_pr_architecture');
    expect(p).toContain('explain_architecture');
    expect(p).toContain('list_changed_files');
    // the specialized agents are described too
    expect(p).toContain('find_breaking_changes');
    expect(p).toContain('assess_merge_risk');
    // even capabilities gated behind a scan are described (full set, not filtered)
    const noScan = buildSystemPrompt('PERSONA', withPr());
    expect(noScan).toContain('explain_architecture');
    expect(noScan).toContain('orient_pr_review');
  });
});
