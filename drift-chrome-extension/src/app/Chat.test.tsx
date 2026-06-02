import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { Chat } from './Chat';
import { emptyReport, type PrContext } from '../core/types';

const URL70 = 'https://github.com/o/r/pull/70';
const FIRST_STEP = /Recognised a Drift scan on r#70/;

function context(): PrContext {
  return {
    pr: { owner: 'o', repo: 'r', number: 70, title: 'Title', url: URL70 },
    report: {
      ...emptyReport(),
      found: true,
      verdict: 'address',
      verdictLabel: 'Address before merge',
      mergeConfidence: { value: 0, outOf: 5 },
      gauges: [{ key: 'risks', label: 'RISKS', display: '6', fraction: null, tone: 'bad' }],
      metricCount: 18,
      sections: [
        { index: 1, title: 'LLM Complexity', metrics: [{ name: 'X', level: 'critical', percent: 80, direction: 'up' }] },
      ],
    },
    artifacts: [{ name: 'pr-scan.json', url: `${URL70}#a`, kind: 'scan-report' }],
    detectedAt: 0,
  };
}

const noop = () => {};
const SETTINGS = { onboarded: true, askBeforeActing: true, theme: 'light' as const };

function renderChat() {
  return render(
    <Chat settings={SETTINGS} onOpenSettings={noop} onOpenContext={noop} />,
  );
}

afterEach(cleanup);

describe('Chat — reasoning + per-PR history', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('streams exactly ONE reasoning turn for a detected PR (no duplicate)', async () => {
    mock.setContext(context());
    renderChat();
    // The streamed reasoning's first step appears…
    await waitFor(() => expect(screen.getByText(FIRST_STEP)).toBeTruthy(), { timeout: 3000 });
    // …and there is exactly one reasoning turn (the duplicate-reasoning bug).
    expect(screen.getAllByText(FIRST_STEP)).toHaveLength(1);
  });

  it('restores a saved conversation instantly — no re-stream, complete reasoning', async () => {
    mock.store.set(`drift:chat:${URL70}`, [
      {
        id: 1,
        role: 'assistant',
        title: 'Reviewing r#70',
        steps: [{ level: 'step', text: 'Recognised a Drift scan on r#70.' }],
        thinking: false,
        prUrl: URL70,
      },
      { id: 2, role: 'user', text: 'my earlier question' },
    ]);
    mock.setContext(context());
    renderChat();

    // The prior user message + completed reasoning are restored from storage.
    await waitFor(() => expect(screen.getByText('my earlier question')).toBeTruthy());
    expect(screen.getByText(FIRST_STEP)).toBeTruthy();
    // Restored complete — no streaming "Thinking…" state, exactly one turn.
    expect(screen.queryByText('Thinking…')).toBeNull();
    expect(screen.getAllByText(FIRST_STEP)).toHaveLength(1);
  });

  it('shows the empty state when no PR is detected', async () => {
    mock.setContext(null);
    renderChat();
    await waitFor(() => expect(screen.getByText('How can I help?')).toBeTruthy());
    expect(screen.queryByText(FIRST_STEP)).toBeNull();
  });
});
