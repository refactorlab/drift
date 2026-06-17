import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import {
  getHandoverSession,
  setHandoverSession,
  clearHandoverSession,
  hasHandoverSession,
  currentStep,
  advance,
  prev,
  gotoIndex,
  isDone,
  remainingSteps,
  findStepIndex,
  type HandoverSession,
  type HandoverStep,
} from './handoverSession';

const step = (path: string, tier: HandoverStep['tier'] = 'core'): HandoverStep => ({
  path,
  code: 'M',
  tier,
  rationale: `why ${path}`,
  additions: 1,
  deletions: 0,
});

function sessionOf(steps: HandoverStep[], cursor = -1): HandoverSession {
  return { prUrl: 'U', sha: 'sha1', steps, cursor, status: 'active', startedAt: 0 };
}

describe('handoverSession storage', () => {
  let store: Map<string, unknown>;
  beforeEach(() => {
    store = installChromeMock().store;
  });

  it('round-trips a session scoped to the PR url', async () => {
    const s = sessionOf([step('a.ts')]);
    await setHandoverSession(s);
    expect(store.has('drift:handover:U')).toBe(true);
    expect((await getHandoverSession('U'))?.steps[0].path).toBe('a.ts');
    expect(await getHandoverSession('OTHER')).toBeNull();
  });

  it('clear removes it; hasHandoverSession tracks existence (active OR done)', async () => {
    await setHandoverSession(sessionOf([step('a.ts')]));
    expect(await hasHandoverSession('U')).toBe(true);
    await setHandoverSession({ ...sessionOf([step('a.ts')]), status: 'done' });
    expect(await hasHandoverSession('U')).toBe(true); // done still exists → resumable
    await clearHandoverSession('U');
    expect(await getHandoverSession('U')).toBeNull();
    expect(await hasHandoverSession('U')).toBe(false); // only 'stop'/clear ends it
  });
});

describe('handoverSession transitions (pure)', () => {
  const steps = [step('a.ts'), step('b.ts'), step('c.ts')];

  it('advance walks from the overview to each file then completes', () => {
    let s = sessionOf(steps, -1);
    expect(currentStep(s)).toBeNull(); // overview
    s = advance(s);
    expect(s.cursor).toBe(0);
    expect(currentStep(s)?.path).toBe('a.ts');
    s = advance(advance(s)); // → b → c
    expect(currentStep(s)?.path).toBe('c.ts');
    expect(isDone(s)).toBe(false);
    s = advance(s); // past the last file
    expect(isDone(s)).toBe(true);
    expect(currentStep(s)?.path).toBe('c.ts'); // cursor stays on the last
  });

  it('prev clamps at the first file and re-activates a done session', () => {
    let s: HandoverSession = { ...sessionOf(steps, 2), status: 'done' };
    s = prev(s);
    expect(s.status).toBe('active');
    expect(currentStep(s)?.path).toBe('b.ts');
    s = prev(prev(s)); // clamp at 0
    expect(s.cursor).toBe(0);
  });

  it('gotoIndex clamps into range', () => {
    expect(gotoIndex(sessionOf(steps), 1).cursor).toBe(1);
    expect(gotoIndex(sessionOf(steps), 99).cursor).toBe(2);
    expect(gotoIndex(sessionOf(steps), -5).cursor).toBe(0);
  });

  it('remainingSteps lists files after the cursor', () => {
    expect(remainingSteps(sessionOf(steps, 0)).map((x) => x.path)).toEqual(['b.ts', 'c.ts']);
    expect(remainingSteps(sessionOf(steps, -1)).map((x) => x.path)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});

describe('findStepIndex', () => {
  const steps = [step('src/core/auth.ts'), step('src/app/Chat.tsx'), step('package.json')];

  it('matches exact path, basename, then substring', () => {
    expect(findStepIndex(steps, 'src/core/auth.ts')).toBe(0); // exact
    expect(findStepIndex(steps, 'Chat.tsx')).toBe(1); // basename
    expect(findStepIndex(steps, 'auth')).toBe(0); // substring
    expect(findStepIndex(steps, 'package.json')).toBe(2);
  });

  it('returns -1 for no match or a too-short query', () => {
    expect(findStepIndex(steps, 'nonexistent.go')).toBe(-1);
    expect(findStepIndex(steps, 'x')).toBe(-1); // too short for substring
    expect(findStepIndex(steps, '')).toBe(-1);
  });
});
