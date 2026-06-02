import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import { getChat, saveChat, clearChat, type ChatMessage } from './chatHistory';

describe('chatHistory (per-PR persistence)', () => {
  beforeEach(() => installChromeMock());

  it('round-trips a conversation scoped to its PR url', async () => {
    const msgs: ChatMessage[] = [{ id: 1, role: 'user', text: 'hi' }];
    await saveChat('https://gh/pull/1', msgs);
    expect(await getChat('https://gh/pull/1')).toEqual(msgs);
    // A different PR has its own (empty) history.
    expect(await getChat('https://gh/pull/2')).toEqual([]);
  });

  it('settles in-flight reasoning on save so a revisit renders it instantly', async () => {
    await saveChat('u', [
      { id: 1, role: 'assistant', steps: [{ level: 'step', text: 'x' }], thinking: true, prUrl: 'u' },
    ]);
    const restored = await getChat('u');
    expect(restored[0].thinking).toBe(false);
    expect(restored[0].steps).toHaveLength(1);
  });

  it('clears only the targeted PR', async () => {
    await saveChat('a', [{ id: 1, role: 'user', text: 'a' }]);
    await saveChat('b', [{ id: 1, role: 'user', text: 'b' }]);
    await clearChat('a');
    expect(await getChat('a')).toEqual([]);
    expect(await getChat('b')).toHaveLength(1);
  });
});
