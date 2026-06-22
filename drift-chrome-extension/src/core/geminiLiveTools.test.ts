import { describe, it, expect, vi } from 'vitest';
import type { BrainRuntime } from './brainRuntime';
import type { FilePresentation } from '../agents/scrollPlan';
import { EMPTY_PR_STATE, type ChatTool, type ToolResult } from './chatTools';
import { LIVE_TOOL_NAMES, buildLiveToolDeclarations, executeLiveTool } from './geminiLiveTools';

const base = () => ({
  state: { ...EMPTY_PR_STATE, scanRan: true }, // pr stays null — the fake tool ignores it
  brain: {} as BrainRuntime, // the fake tool never touches it
  userText: 'go to pr handover mode',
  signal: new AbortController().signal,
});

const handlers = () => ({
  onToolStart: vi.fn(),
  onToolProgress: vi.fn(),
  onToolEnd: vi.fn(),
  onStatePatch: vi.fn(),
  onPresentation: vi.fn(),
});

const fakeTool = (run: ChatTool['run']): ChatTool => ({ name: 'pr_handover_mode', description: 'd', capability: 'c', available: () => true, run });

describe('buildLiveToolDeclarations', () => {
  it('declares exactly the exposed drift tools, arg-less, with their descriptions', () => {
    const decls = buildLiveToolDeclarations();
    expect(decls.map((d) => d.name)).toEqual([...LIVE_TOOL_NAMES]);
    for (const d of decls) {
      expect(d.description && d.description.length).toBeGreaterThan(0);
      expect((d.parameters as { type?: string }).type).toBe('OBJECT');
    }
  });
});

describe('executeLiveTool', () => {
  it('runs the tool and drives the UI handlers, returning the narratable outcome', async () => {
    const presentation = { path: 'a.ts', anchorId: 'diff-a', beats: [] } as unknown as FilePresentation;
    const result: ToolResult = { ok: true, content: 'full walkthrough', spoken: 'short', summary: 'File 1/3', statePatch: { handoverActive: true }, presentation, final: true };
    const h = handlers();
    const out = await executeLiveTool('pr_handover_mode', {}, base(), h, () => fakeTool(async () => result));

    expect(out).toEqual({ ok: true, content: 'full walkthrough', spoken: 'short' });
    expect(h.onToolStart).toHaveBeenCalledWith('pr_handover_mode');
    expect(h.onStatePatch).toHaveBeenCalledWith({ handoverActive: true });
    expect(h.onPresentation).toHaveBeenCalledWith(presentation);
    expect(h.onToolEnd).toHaveBeenCalledWith('pr_handover_mode', true, 'File 1/3', undefined);
  });

  it('returns an error outcome for an unknown tool', async () => {
    const out = await executeLiveTool('nope', {}, base(), handlers(), () => undefined);
    expect(out.ok).toBe(false);
    expect(out.content).toMatch(/unknown tool/i);
  });

  it('reports a thrown tool failure on the card and relays an error outcome', async () => {
    const h = handlers();
    const out = await executeLiveTool(
      'pr_handover_mode',
      {},
      base(),
      h,
      () => fakeTool(async () => {
        throw new Error('scan exploded');
      }),
    );
    expect(out.ok).toBe(false);
    expect(out.content).toMatch(/scan exploded/);
    const end = h.onToolEnd.mock.calls[0];
    expect(end[1]).toBe(false); // ok
    expect(end[3]).toMatch(/scan exploded/); // details = failure report
  });
});
