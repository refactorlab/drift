import { describe, it, expect } from 'vitest';
import {
  countTokens,
  countMsgTokens,
  estimateTokens,
  truncateToTokens,
  turnToMsg,
  sliceTurnsByTokens,
  planContext,
  buildMessages,
  type Turn,
} from './chatContext';

describe('chatContext token counting', () => {
  it('counts tokens and per-message overhead', () => {
    expect(countTokens('')).toBe(0);
    expect(countTokens('hello world')).toBeGreaterThan(0);
    const msgs = [
      { role: 'user' as const, content: 'hi' },
      { role: 'assistant' as const, content: 'hello there' },
    ];
    // +4 overhead per message.
    expect(countMsgTokens(msgs)).toBe(countTokens('hi') + 4 + countTokens('hello there') + 4);
  });
});

describe('estimateTokens (aider-style sampling for large text)', () => {
  it('is exact for short text (under the sample threshold)', () => {
    expect(estimateTokens('hello world')).toBe(countTokens('hello world'));
    expect(estimateTokens('')).toBe(0);
  });

  it('approximates large text within ~25% of the exact count without encoding it all', () => {
    const big = Array.from({ length: 5000 }, (_, i) => `const value_${i} = compute(${i});`).join('\n');
    const exact = countTokens(big);
    const est = estimateTokens(big);
    expect(Math.abs(est - exact) / exact).toBeLessThan(0.25); // sampled estimate tracks the real count
  });
});

describe('truncateToTokens (exact encode → slice → decode)', () => {
  it('is a no-op under budget', () => {
    expect(truncateToTokens('short text', 100)).toBe('short text');
  });

  it('cuts to the token budget and marks it', () => {
    const out = truncateToTokens('word '.repeat(500), 50);
    expect(out).toContain('truncated');
    expect(countTokens(out)).toBeLessThanOrEqual(50 + countTokens('\n…(truncated)') + 1);
  });
});

describe('turnToMsg', () => {
  it('maps display roles to chat roles', () => {
    expect(turnToMsg({ role: 'user', text: 'q' })).toEqual({ role: 'user', content: 'q' });
    expect(turnToMsg({ role: 'agent', text: 'a' })).toEqual({ role: 'assistant', content: 'a' });
  });
});

describe('sliceTurnsByTokens', () => {
  const turns: Turn[] = [
    { role: 'user', text: 'one' },
    { role: 'agent', text: 'two' },
    { role: 'user', text: 'three' },
  ];

  it('no budget → returns all', () => {
    expect(sliceTurnsByTokens(turns, 0)).toEqual(turns);
  });

  it('keeps the most-recent suffix that fits', () => {
    // Budget for just the last turn.
    const last = countTokens('three') + 4;
    const kept = sliceTurnsByTokens(turns, last);
    expect(kept).toEqual([{ role: 'user', text: 'three' }]);
  });

  it('never begins history on an orphaned assistant reply', () => {
    // A budget that fits the last two turns (agent 'two' + user 'three') — but the
    // suffix would start on an 'agent' turn, so it must be dropped.
    const budget = countTokens('two') + 4 + countTokens('three') + 4;
    const kept = sliceTurnsByTokens(turns, budget);
    expect(kept[0]?.role).not.toBe('agent');
  });
});

describe('planContext', () => {
  const turns: Turn[] = [
    { role: 'user', text: 'a' },
    { role: 'agent', text: 'b' },
  ];

  it('unlimited → returns the whole transcript', () => {
    expect(planContext(turns, 'sys', 'now', 0, 4000, undefined, true)).toEqual(turns);
  });

  it('message window only when budget <= 0', () => {
    expect(planContext(turns, 'sys', 'now', 1, 0, undefined, false)).toEqual([{ role: 'agent', text: 'b' }]);
  });

  it('drops history entirely when fixed parts exceed the budget', () => {
    expect(planContext(turns, 'sys', 'now', 0, 5, undefined, false)).toEqual([]);
  });
});

describe('buildMessages', () => {
  it('assembles system + history + current user turn', () => {
    const msgs = buildMessages(
      'persona',
      [
        { role: 'user', text: 'prev q' },
        { role: 'agent', text: 'prev a' },
      ],
      'current',
      { unlimited: true },
    );
    expect(msgs[0]).toEqual({ role: 'system', content: 'persona' });
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'current' });
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });
});
