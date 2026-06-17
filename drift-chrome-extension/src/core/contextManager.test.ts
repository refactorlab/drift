import { describe, it, expect } from 'vitest';
import { ConversationContext } from './contextManager';

describe('ConversationContext.toMessages', () => {
  it('emits exactly one system message (index 0) with no summary', () => {
    const ctx = new ConversationContext([{ role: 'user', text: 'hi' }]);
    const msgs = ctx.toMessages('PERSONA', 'how are you?');
    const systems = msgs.filter((m) => m.role === 'system');
    expect(systems).toHaveLength(1);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toBe('PERSONA');
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'how are you?' });
  });

  it('folds the running summary INTO the single system message — never a 2nd system turn', async () => {
    // Build enough history to cross CONTEXT_MAX_TOKENS so compact() summarizes.
    const big = 'word '.repeat(600);
    const ctx = new ConversationContext(
      Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'agent' : ('user' as const), text: big })),
    );
    await ctx.compact(async () => 'RUNNING SUMMARY');

    const msgs = ctx.toMessages('PERSONA', 'next question');
    // WebLLM throws SystemMessageOrderError if a `system` message is not at index 0,
    // and it only supports ONE — so persona + summary MUST be a single system turn.
    const systems = msgs.filter((m) => m.role === 'system');
    expect(systems).toHaveLength(1);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('PERSONA');
    expect(msgs[0].content).toContain('RUNNING SUMMARY');
    // No other message may carry the system role.
    expect(msgs.slice(1).some((m) => m.role === 'system')).toBe(false);
  });
});
