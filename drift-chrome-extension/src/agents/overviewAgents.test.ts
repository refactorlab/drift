import { describe, expect, it } from 'vitest';
import { runLevel1Agent, runLevel2Agent, summaryStatus, LEVEL1_SYSTEM, LEVEL2_SYSTEM } from './overviewAgents';
import type { BrainRuntime } from '../core/brainRuntime';
import type { ChatTurn } from '../core/chatContext';

/** A fake brain: records the prompts it sees and returns a scripted reply (by index). */
function fakeBrain(reply: string | ((messages: ChatTurn[]) => string)) {
  const prompts: string[] = [];
  const brain: BrainRuntime = {
    async generate(messages) {
      prompts.push(messages.map((m) => `${m.role}: ${m.content}`).join('\n'));
      return typeof reply === 'function' ? reply(messages) : reply;
    },
    async complete() {
      return '';
    },
    interrupt() {},
    free() {},
  };
  return { brain, prompts };
}

const input = (brain: BrainRuntime, over: Partial<Parameters<typeof runLevel1Agent>[0]> = {}) => ({
  brain,
  signal: new AbortController().signal,
  path: 'src/app/LivePipelineRun.tsx',
  verb: 'adds',
  context: 'How this file fits the change:\n- Why it matters: Runs the live PR scan',
  code: '[H0] loadWasmModule (lines 53-57):\nfunction loadWasmModule() {}',
  ...over,
});

describe('runLevel1Agent', () => {
  it('returns the model sentence and grounds the prompt in the change + role + code', async () => {
    const { brain, prompts } = fakeBrain('Adds the WASM scanner loader and wires it into the live run pipeline.');
    const out = await runLevel1Agent(input(brain));
    expect(out).toBe('Adds the WASM scanner loader and wires it into the live run pipeline.');
    expect(prompts[0]).toContain(LEVEL1_SYSTEM);
    expect(prompts[0]).toContain('adds src/app/LivePipelineRun.tsx');
    expect(prompts[0]).toContain('Runs the live PR scan'); // the correlation context (its role)
    expect(prompts[0]).toContain('loadWasmModule'); // the real code
  });

  it('strips a leaked label and any annotation tag the small model prepends', async () => {
    const { brain } = fakeBrain('Level 1: Adds the loader. [H0] ignore this trailing note.');
    expect(await runLevel1Agent(input(brain))).toBe('Adds the loader.');
  });

  it('returns "" when the model gives nothing (caller falls back to the grounded line)', async () => {
    const { brain } = fakeBrain('');
    expect(await runLevel1Agent(input(brain))).toBe('');
  });
});

describe('runLevel2Agent', () => {
  it('returns the responsibility summary and asks specifically about the file', async () => {
    const { brain, prompts } = fakeBrain('Renders the live pipeline run and formats progress for the UI.');
    const out = await runLevel2Agent(input(brain));
    expect(out).toBe('Renders the live pipeline run and formats progress for the UI.');
    expect(prompts[0]).toContain(LEVEL2_SYSTEM);
    expect(prompts[0]).toContain('What is LivePipelineRun.tsx responsible for?');
  });

  it('survives a model error (resolves to "")', async () => {
    const brain: BrainRuntime = {
      async generate() {
        throw new Error('boom');
      },
      async complete() {
        return '';
      },
      interrupt() {},
      free() {},
    };
    expect(await runLevel2Agent(input(brain))).toBe('');
  });
});

describe('summaryStatus', () => {
  it('names the level being summarized, with a varied verb, ending in an ellipsis', () => {
    for (const level of [1, 2] as const) {
      const s = summaryStatus(level);
      expect(s).toMatch(new RegExp(`level ${level}…$`));
      expect(s.length).toBeGreaterThan(`level ${level}…`.length); // carries a leading verb word
    }
  });
});
