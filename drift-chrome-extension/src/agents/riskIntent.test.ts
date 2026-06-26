import { describe, it, expect } from 'vitest';
import { isRiskQuestion } from './riskIntent';

describe('isRiskQuestion — fires on risk / merge-safety questions', () => {
  it('catches the exact transcript phrasings that confabulated "no risks"', () => {
    for (const q of [
      'in the risk. Can you explain the risk in this PR?',
      'Can you explain the risk in this PR?',
      'explain the risk',
      'what is the risk in this PR',
    ])
      expect(isRiskQuestion(q)).toBe(true);
  });

  it('catches direct risk words', () => {
    for (const q of [
      "what's the risk",
      'what are the risks here',
      'is this risky',
      'how risky is this PR',
      'any red flags?',
      "what's the blast radius",
      'is this fragile',
      'are there regressions',
      'what are the gotchas',
    ])
      expect(isRiskQuestion(q)).toBe(true);
  });

  it('catches merge-safety questions without the word "risk"', () => {
    for (const q of [
      'is this safe to merge',
      'is it safe to merge?',
      'can I safely merge this',
      'should I merge this',
      'should we ship this',
      'is this change safe?',
      'are these changes dangerous',
      "what's blocking this",
      'merge confidence?',
    ])
      expect(isRiskQuestion(q)).toBe(true);
  });

  it('catches "what could go wrong / what did I miss / what to address" shapes', () => {
    for (const q of [
      'what could go wrong',
      'what could break',
      'what might fail here',
      'what did I miss',
      'what should I double-check',
      'what should I worry about',
      'what should I fix first',
      'any concerns with this PR',
      'are there any issues',
    ])
      expect(isRiskQuestion(q)).toBe(true);
  });
});

describe('isRiskQuestion — does NOT steal other routes', () => {
  it('ignores handover control utterances', () => {
    for (const q of ['walk me through this PR', 'next', 'proceed', 'go to auth.ts', 'where are we', 'stop the walkthrough'])
      expect(isRiskQuestion(q)).toBe(false);
  });

  it('ignores file / architecture / list questions', () => {
    for (const q of [
      'what does this file do',
      'what does the run function do here',
      'which files changed',
      'list the changed files',
      "what's the architecture",
      'how does the gemini controller work',
      'summarize the features',
      'explain the architecture',
    ])
      expect(isRiskQuestion(q)).toBe(false);
  });

  it('ignores greetings, chit-chat, and unrelated (perf/cost) questions', () => {
    for (const q of [
      'hi',
      'thanks',
      'what can you do',
      'how could it affect my latency',
      'how does this affect memory and CPU',
      'what about the cost',
    ])
      expect(isRiskQuestion(q)).toBe(false);
  });

  it('ignores empty / whitespace', () => {
    expect(isRiskQuestion('')).toBe(false);
    expect(isRiskQuestion('   ')).toBe(false);
  });
});
